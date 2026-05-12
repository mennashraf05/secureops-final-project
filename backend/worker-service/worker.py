import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pika
from sqlalchemy import DateTime, Integer, String, Text, create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

from shared.config import settings
from shared.audit_client import send_audit_event


QUEUE_NAME = "report_jobs"
REPORTS_DIR = Path("/app/reports")


class Base(DeclarativeBase):
    pass


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False, index=True)
    requested_by: Mapped[int | None] = mapped_column(Integer, nullable=True)
    result_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def rabbitmq_parameters() -> pika.ConnectionParameters:
    credentials = pika.PlainCredentials(settings.rabbitmq_user, settings.rabbitmq_password)
    return pika.ConnectionParameters(
        host=settings.rabbitmq_host,
        port=settings.rabbitmq_port,
        credentials=credentials,
        heartbeat=60,
        blocked_connection_timeout=30,
    )


def connect_with_retry(max_attempts: int = 30, delay_seconds: int = 5) -> pika.BlockingConnection:
    for attempt in range(1, max_attempts + 1):
        try:
            return pika.BlockingConnection(rabbitmq_parameters())
        except pika.exceptions.AMQPConnectionError:
            print(f"RabbitMQ not ready, retrying ({attempt}/{max_attempts})...", flush=True)
            time.sleep(delay_seconds)

    raise RuntimeError("Could not connect to RabbitMQ after retries.")


def load_message(body: bytes) -> dict[str, Any]:
    payload = json.loads(body.decode("utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("Report job message must be an object.")
    if not payload.get("job_id") or payload.get("type") not in {"inventory_report", "low_stock_report", "security_report", "audit_report"}:
        raise ValueError("Unsupported report job message.")
    return payload


def set_job_failed(db: Session, job_id: int, message: str) -> None:
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        print(f"Report job {job_id} not found while marking failed.", flush=True)
        return

    job.status = "failed"
    job.error_message = message
    job.completed_at = datetime.now(timezone.utc)
    db.add(job)
    db.commit()


def separator() -> str:
    return "=" * 50


def money(value: Any) -> str:
    try:
        return f"{float(value):,.2f}"
    except (TypeError, ValueError):
        return "0.00"


def safe_rows(db: Session, statement: str) -> list[dict[str, Any]] | None:
    try:
        return [dict(row) for row in db.execute(text(statement)).mappings().all()]
    except SQLAlchemyError:
        return None


def safe_scalar(db: Session, statement: str, default: int = 0) -> int:
    try:
        return int(db.execute(text(statement)).scalar() or default)
    except SQLAlchemyError:
        return default


def redact_details(value: Any, max_length: int = 180) -> str:
    if not value:
        return "No details"
    text_value = str(value)
    sensitive_terms = [
        "password", "password_hash", "token", "secret", "api_key", "authorization",
        "smtp", "github_client_secret", "telegram_bot_token", "rabbitmq_password",
        "internal_api_key", "jwt",
    ]
    lowered = text_value.lower()
    if any(term in lowered for term in sensitive_terms):
        return "[redacted sensitive details]"
    return text_value[:max_length] + ("..." if len(text_value) > max_length else "")


def stock_status(quantity: int, threshold: int = 5) -> str:
    if quantity <= 0:
        return "Out of Stock"
    if quantity <= threshold:
        return "Low Stock"
    return "Available"


def write_inventory_report(db: Session, job_id: int, requested_by: int | None) -> str:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    report_path = REPORTS_DIR / f"inventory_report_job_{job_id}.txt"
    generated_at = datetime.now(timezone.utc).isoformat()
    products = safe_rows(
        db,
        """
        SELECT id, name, sku, category, price, quantity
        FROM products
        ORDER BY category ASC, name ASC
        """,
    )

    lines = [
        "SecureOps Inventory Report",
        separator(),
        "",
        "Report Metadata",
        "---------------",
        f"Job ID: {job_id}",
        "Report Type: Inventory Report",
        f"Generated At: {generated_at}",
        f"Requested By User ID: {requested_by if requested_by is not None else 'Unknown'}",
        "Status: Completed",
        "Generated By: Worker Service",
        "",
    ]

    if products is None:
        lines.extend([
            "Executive Summary",
            "-----------------",
            "Data source unavailable in this environment.",
            "",
        ])
    else:
        total_products = len(products)
        low_stock = sum(1 for product in products if 0 < int(product["quantity"]) <= 5)
        out_of_stock = sum(1 for product in products if int(product["quantity"]) <= 0)
        total_units = sum(int(product["quantity"]) for product in products)
        total_value = sum(float(product["price"]) * int(product["quantity"]) for product in products)
        average_price = sum(float(product["price"]) for product in products) / total_products if total_products else 0
        healthy = total_products - low_stock - out_of_stock

        lines.extend([
            "Executive Summary",
            "-----------------",
            f"Total Products: {total_products}",
            f"Low Stock Items: {low_stock}",
            f"Out of Stock Items: {out_of_stock}",
            f"Total Inventory Value: {money(total_value)}",
            f"Average Product Price: {money(average_price)}",
            f"Total Units in Stock: {total_units}",
            "",
            "Inventory Health",
            "----------------",
            f"Healthy Items: {healthy}",
            f"Low Stock Items: {low_stock}",
            f"Out of Stock Items: {out_of_stock}",
            "",
            "Product Details",
            "---------------",
        ])
        if products:
            for index, product in enumerate(products, start=1):
                quantity = int(product["quantity"])
                lines.extend([
                    f"{index}. {product['name']}",
                    f"   ID: {product['id']}",
                    f"   SKU: {product['sku']}",
                    f"   Category: {product['category']}",
                    f"   Price: {money(product['price'])}",
                    f"   Quantity: {quantity}",
                    f"   Stock Status: {stock_status(quantity)}",
                    "",
                ])
        else:
            lines.extend(["No products found.", ""])

    lines.extend([
        "Recommendations",
        "---------------",
        "- Review low-stock products.",
        "- Reorder out-of-stock or critical inventory.",
        "- Keep product prices and quantities updated.",
        "",
        "System Flow",
        "-----------",
        "Report Service created the job.",
        "RabbitMQ queued the job.",
        "Worker Service processed the job.",
        "PostgreSQL stored the job status.",
        "",
    ])
    report_path.write_text("\n".join(lines), encoding="utf-8")
    return str(report_path)


def write_low_stock_report(db: Session, job_id: int, requested_by: int | None) -> str:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    report_path = REPORTS_DIR / f"low_stock_report_job_{job_id}.txt"
    generated_at = datetime.now(timezone.utc).isoformat()
    products = safe_rows(
        db,
        """
        SELECT id, name, sku, category, quantity
        FROM products
        WHERE quantity <= 5
        ORDER BY quantity ASC, name ASC
        """,
    )

    lines = [
        "SecureOps Low Stock Report",
        separator(),
        "",
        "Report Metadata",
        "---------------",
        f"Job ID: {job_id}",
        f"Generated At: {generated_at}",
        f"Requested By User ID: {requested_by if requested_by is not None else 'Unknown'}",
        "Status: Completed",
        "",
    ]

    if products is None:
        lines.extend(["Summary", "-------", "Data source unavailable in this environment.", ""])
    else:
        low_stock = sum(1 for product in products if 0 < int(product["quantity"]) <= 5)
        out_of_stock = sum(1 for product in products if int(product["quantity"]) <= 0)
        affected_categories = len({str(product["category"]) for product in products})
        lines.extend([
            "Summary",
            "-------",
            f"Low Stock Items: {low_stock}",
            f"Out of Stock Items: {out_of_stock}",
            f"Affected Categories: {affected_categories}",
            "",
            "Low Stock Product Details",
            "-------------------------",
        ])
        for product in products:
            quantity = int(product["quantity"])
            threshold = 5
            action = "Restock immediately" if quantity <= 0 else "Review and reorder soon"
            lines.append(
                f"- ID: {product['id']} | Name: {product['name']} | SKU: {product['sku']} | "
                f"Category: {product['category']} | Quantity: {quantity} | Threshold: {threshold} | "
                f"Suggested Action: {action}"
            )
        if not products:
            lines.append("No low stock products found.")

    lines.extend([
        "",
        "Recommendations",
        "---------------",
        "- Prioritize out-of-stock products.",
        "- Review low-stock categories.",
        "- Create purchase orders or restock requests.",
        "",
    ])
    report_path.write_text("\n".join(lines), encoding="utf-8")
    return str(report_path)


def write_security_report(db: Session, job_id: int, requested_by: int | None) -> str:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    report_path = REPORTS_DIR / f"security_report_job_{job_id}.txt"
    generated_at = datetime.now(timezone.utc).isoformat()

    rows = safe_rows(
        db,
        """
        SELECT id, user_id, action, service_name, ip_address, status, details, created_at
        FROM audit_logs
        WHERE status IN ('failure', 'blocked')
           OR action IN (
               'auth.login.failed',
               'auth.unauthorized',
               'auth.admin.denied',
               'audit.admin.denied',
               'inventory.admin.denied',
               'orders.admin.denied',
               'orders.ownership.denied',
               'reports.admin.denied',
               'reports.job.failed',
               'inventory.stock.deduct.failed',
               'malicious.file.upload',
               'file.integrity.failed'
           )
        ORDER BY created_at DESC
        LIMIT 100
        """,
    )

    rows = rows or []
    failed_logins = sum(1 for row in rows if row["action"] == "auth.login.failed")
    unauthorized = sum(1 for row in rows if row["action"] == "auth.unauthorized")
    admin_denied = sum(1 for row in rows if str(row["action"]).endswith("admin.denied"))
    ownership_denied = sum(1 for row in rows if row["action"] == "orders.ownership.denied")
    blocked = sum(1 for row in rows if row["status"] == "blocked")
    risk_score = min((failed_logins * 5) + (unauthorized * 10) + (admin_denied * 15), 100)
    if risk_score >= 75:
        risk_level = "Critical"
    elif risk_score >= 50:
        risk_level = "High"
    elif risk_score >= 25:
        risk_level = "Medium"
    else:
        risk_level = "Low"

    action_counts: dict[str, int] = {}
    for row in rows:
        action = str(row["action"])
        action_counts[action] = action_counts.get(action, 0) + 1

    lines = [
        "SecureOps Security Report",
        separator(),
        "",
        "Report Metadata",
        "---------------",
        f"Job ID: {job_id}",
        f"Generated At: {generated_at}",
        f"Requested By User ID: {requested_by if requested_by is not None else 'Unknown'}",
        "Status: Completed",
        "Generated By: Worker Service",
        "",
        "Security Summary",
        "----------------",
        f"Failed Logins: {failed_logins}",
        f"Unauthorized Attempts: {unauthorized}",
        f"Admin Denied Events: {admin_denied}",
        f"Ownership Denied Events: {ownership_denied}",
        f"Critical/Blocked Events: {blocked}",
        f"Recent Security Events Reviewed: {len(rows)}",
        f"Risk Score: {risk_score}",
        f"Risk Level: {risk_level}",
        "",
        "Risk Indicators",
        "---------------",
    ]

    if action_counts:
        for action, count in sorted(action_counts.items(), key=lambda item: item[1], reverse=True)[:10]:
            lines.append(f"- {action}: {count}")
    else:
        lines.append("- No recent risk factors found.")

    lines.extend(["", "Recent Security Events", "----------------------"])
    if rows:
        for row in rows[:20]:
            lines.append(
                f"- Time: {row['created_at']} | Service: {row['service_name']} | "
                f"Action: {row['action']} | User ID: {row['user_id'] or 'system'} | "
                f"IP Address: {row['ip_address'] or 'n/a'} | Status: {row['status']}"
            )
    else:
        lines.append("- No recent security events found.")

    lines.extend([
        "",
        "Recommendations",
        "---------------",
        "- Investigate repeated failed login attempts.",
        "- Review unauthorized access attempts.",
        "- Confirm RBAC rules are working.",
        "- Monitor high-risk users in Security Center.",
        "",
        "Notes",
        "-----",
        "This report is generated from centralized Audit Logs and Security Center data.",
        "This report is generated from Audit Service security events.",
        "",
    ])
    report_path.write_text("\n".join(lines), encoding="utf-8")
    return str(report_path)


def write_audit_report(db: Session, job_id: int, requested_by: int | None) -> str:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    report_path = REPORTS_DIR / f"audit_report_job_{job_id}.txt"
    generated_at = datetime.now(timezone.utc).isoformat()

    total = safe_scalar(db, "SELECT COUNT(*) FROM audit_logs")
    status_rows = safe_rows(db, "SELECT status, COUNT(*) AS count FROM audit_logs GROUP BY status ORDER BY status") or []
    service_rows = safe_rows(db, "SELECT service_name, COUNT(*) AS count FROM audit_logs GROUP BY service_name ORDER BY count DESC, service_name") or []
    recent_rows = safe_rows(
        db,
        """
        SELECT id, user_id, action, service_name, ip_address, status, details, created_at
        FROM audit_logs
        ORDER BY created_at DESC
        LIMIT 20
        """,
    ) or []

    status_counts = {str(row["status"]): int(row["count"]) for row in status_rows}
    lines = [
        "SecureOps Audit Report",
        separator(),
        "",
        "Report Metadata",
        "---------------",
        f"Job ID: {job_id}",
        f"Generated At: {generated_at}",
        f"Requested By User ID: {requested_by if requested_by is not None else 'Unknown'}",
        "Status: Completed",
        "Generated By: Worker Service",
        "",
        "Audit Summary",
        "-------------",
        f"Total Audit Logs: {total}",
        f"Success Events: {status_counts.get('success', 0)}",
        f"Failure Events: {status_counts.get('failure', 0)}",
        f"Blocked Events: {status_counts.get('blocked', 0)}",
        f"Info Events: {status_counts.get('info', 0)}",
        "",
        "Count by status:",
    ]
    for audit_status in ["success", "failure", "blocked", "info"]:
        lines.append(f"- {audit_status}: {status_counts.get(audit_status, 0)}")

    lines.extend(["", "Events by Service", "-----------------"])
    if service_rows:
        for row in service_rows:
            lines.append(f"- {row['service_name']}: {row['count']}")
    else:
        lines.append("- No service counts found.")

    top_actions = safe_rows(
        db,
        "SELECT action, COUNT(*) AS count FROM audit_logs GROUP BY action ORDER BY count DESC, action LIMIT 10",
    ) or []
    lines.extend(["", "Top Actions", "-----------"])
    if top_actions:
        for row in top_actions:
            lines.append(f"- {row['action']}: {row['count']}")
    else:
        lines.append("- No actions found.")

    lines.extend(["", "Recent Audit Events", "-------------------"])
    if recent_rows:
        for row in recent_rows:
            lines.append(
                f"- ID: {row['id']} | Timestamp: {row['created_at']} | Service: {row['service_name']} | "
                f"Action: {row['action']} | User ID: {row['user_id'] or 'system'} | "
                f"IP Address: {row['ip_address'] or 'n/a'} | Status: {row['status']} | "
                f"Details: {redact_details(row.get('details'))}"
            )
    else:
        lines.append("- No audit events found.")

    lines.extend([
        "",
        "Compliance Notes",
        "----------------",
        "- Audit logs provide accountability for critical system actions.",
        "- Admin actions, authentication events, authorization failures, and background job activity are recorded.",
        "- Technical details are logged internally while frontend responses remain safe.",
        "",
        "Notes:",
        "This report is generated from centralized Audit Logs.",
        "",
    ])
    report_path.write_text("\n".join(lines), encoding="utf-8")
    return str(report_path)


def process_report_job(payload: dict[str, Any]) -> None:
    job_id = int(payload["job_id"])
    job_type = payload["type"]

    with SessionLocal() as db:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            raise ValueError(f"Report job {job_id} was not found.")

        job.status = "processing"
        job.error_message = None
        db.add(job)
        db.commit()
        send_audit_event(
            "reports.job.processing",
            "worker-service",
            "info",
            user_id=job.requested_by,
            details={"job_id": job.id, "type": job.type},
        )

        try:
            time.sleep(2)
            if job_type == "inventory_report":
                result_path = write_inventory_report(db, job_id, job.requested_by)
            elif job_type == "low_stock_report":
                result_path = write_low_stock_report(db, job_id, job.requested_by)
            elif job_type == "security_report":
                result_path = write_security_report(db, job_id, job.requested_by)
            elif job_type == "audit_report":
                result_path = write_audit_report(db, job_id, job.requested_by)
            else:
                raise ValueError("Unsupported report job type.")
            job.status = "completed"
            job.result_path = result_path
            job.completed_at = datetime.now(timezone.utc)
            db.add(job)
            db.commit()
            send_audit_event(
                "reports.job.completed",
                "worker-service",
                "success",
                user_id=job.requested_by,
                details={"job_id": job.id, "type": job.type, "result_path": result_path},
            )
            print(f"Completed report job {job_id}.", flush=True)
        except Exception as exc:
            db.rollback()
            set_job_failed(db, job_id, "Report generation failed.")
            send_audit_event(
                "reports.job.failed",
                "worker-service",
                "failure",
                user_id=job.requested_by,
                details={"job_id": job_id, "type": job_type},
            )
            raise RuntimeError(f"Report job {job_id} failed.") from exc


def handle_message(
    channel: pika.adapters.blocking_connection.BlockingChannel,
    method: pika.spec.Basic.Deliver,
    _properties: pika.BasicProperties,
    body: bytes,
) -> None:
    job_id: int | None = None
    try:
        payload = load_message(body)
        job_id = int(payload["job_id"])
        process_report_job(payload)
    except Exception as exc:
        print(f"Report job failed: {exc}", flush=True)
        if job_id is not None:
            with SessionLocal() as db:
                set_job_failed(db, job_id, "Report generation failed.")
            send_audit_event(
                "reports.job.failed",
                "worker-service",
                "failure",
                details={"job_id": job_id},
            )
    finally:
        channel.basic_ack(delivery_tag=method.delivery_tag)


def main() -> None:
    Base.metadata.create_all(bind=engine)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    while True:
        connection: pika.BlockingConnection | None = None
        try:
            connection = connect_with_retry()
            channel = connection.channel()
            channel.queue_declare(queue=QUEUE_NAME, durable=True)
            channel.basic_qos(prefetch_count=1)
            channel.basic_consume(queue=QUEUE_NAME, on_message_callback=handle_message)
            print("Worker connected to RabbitMQ and waiting for report jobs.", flush=True)
            channel.start_consuming()
        except KeyboardInterrupt:
            print("Worker shutting down", flush=True)
            if connection and connection.is_open:
                connection.close()
            break
        except Exception as exc:
            print(f"Worker connection error: {exc}", flush=True)
            if connection and connection.is_open:
                connection.close()
            time.sleep(5)


if __name__ == "__main__":
    main()
