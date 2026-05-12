from collections import defaultdict
from datetime import datetime, timedelta, timezone
import json

from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_, text
from sqlalchemy.orm import Session

from dependencies import CurrentUser
from models import ALLOWED_AUDIT_STATUSES, AuditLog, DismissedSecurityAlert, Notification
from schemas import AuditLogCreate
from telegram_service import send_telegram_for_audit_log


SECURITY_ACTIONS = {
    "auth.login.failed",
    "auth.unauthorized",
    "auth.admin.denied",
    "audit.admin.denied",
    "inventory.admin.denied",
    "orders.admin.denied",
    "orders.ownership.denied",
    "reports.admin.denied",
    "reports.job.failed",
    "inventory.stock.deduct.failed",
    "malicious.file.upload",
    "file.integrity.failed",
}

RISK_IMPACTS = {
    "auth.login.failed": 5,
    "auth.unauthorized": 10,
    "auth.admin.denied": 15,
    "audit.admin.denied": 15,
    "inventory.admin.denied": 15,
    "orders.admin.denied": 15,
    "orders.ownership.denied": 20,
    "reports.admin.denied": 15,
    "reports.job.failed": 10,
    "inventory.stock.deduct.failed": 20,
    "malicious.file.upload": 30,
    "file.integrity.failed": 35,
}

ALERT_TITLES = {
    "auth.login.failed": "Failed login detected",
    "auth.unauthorized": "Unauthorized access attempt",
    "auth.admin.denied": "Admin endpoint denied",
    "audit.admin.denied": "Admin endpoint denied",
    "inventory.admin.denied": "Admin endpoint denied",
    "orders.admin.denied": "Admin endpoint denied",
    "reports.admin.denied": "Admin endpoint denied",
    "orders.ownership.denied": "Ownership violation attempt",
    "reports.job.failed": "Report job failed",
    "inventory.stock.deduct.failed": "Stock deduction failed",
}

ALLOWED_NOTIFICATION_CATEGORIES = {"order", "report", "security", "audit", "account", "system"}
ALLOWED_NOTIFICATION_SEVERITIES = {"info", "success", "warning", "critical"}

SECURITY_NOTIFICATION_META = {
    "auth.login.failed": ("Failed login detected", "A failed login attempt was recorded.", "warning"),
    "auth.unauthorized": ("Unauthorized access attempt", "A blocked unauthorized request was recorded.", "critical"),
    "orders.ownership.denied": ("Unauthorized access attempt", "A user attempted to access another user's order.", "critical"),
    "reports.job.failed": ("Report failed", "A report job failed.", "warning"),
    "inventory.stock.deduct.failed": ("Stock deduction failed", "An internal stock deduction attempt failed.", "critical"),
}


def parse_details(details: str | None) -> dict[str, object]:
    if not details:
        return {}
    try:
        parsed = json.loads(details)
    except (TypeError, json.JSONDecodeError):
        return {}
    return parsed if isinstance(parsed, dict) else {}


def int_detail(details: dict[str, object], *keys: str) -> int | None:
    for key in keys:
        value = details.get(key)
        if value is None:
            continue
        try:
            return int(value)
        except (TypeError, ValueError):
            continue
    return None


def create_notification(
    db: Session,
    *,
    user_id: int | None,
    role_target: str | None,
    title: str,
    message: str,
    category: str,
    severity: str,
    source_service: str | None = None,
    source_action: str | None = None,
    source_id: int | None = None,
    commit: bool = True,
) -> Notification:
    clean_category = category.strip().lower()
    clean_severity = severity.strip().lower()
    clean_role = role_target.strip().lower() if role_target else None

    if clean_category not in ALLOWED_NOTIFICATION_CATEGORIES:
        raise ValueError("Unsupported notification category.")
    if clean_severity not in ALLOWED_NOTIFICATION_SEVERITIES:
        raise ValueError("Unsupported notification severity.")
    if clean_role not in {None, "admin", "user", "all"}:
        raise ValueError("Unsupported notification role target.")

    notification = Notification(
        user_id=user_id,
        role_target=clean_role,
        title=title.strip(),
        message=message.strip(),
        category=clean_category,
        severity=clean_severity,
        source_service=source_service,
        source_action=source_action,
        source_id=source_id,
    )
    db.add(notification)
    if commit:
        db.commit()
        db.refresh(notification)
    else:
        db.flush()
    return notification


def notification_visibility_filter(current_user: CurrentUser):
    if current_user.role == "admin":
        return or_(
            Notification.role_target.in_(["admin", "all"]),
            and_(Notification.user_id.is_(None), Notification.category.in_(["security", "report", "order", "audit", "system"])),
        )

    return or_(
        Notification.user_id == current_user.id,
        Notification.role_target.in_(["user", "all"]),
    )


def get_notifications_for_user(
    db: Session,
    *,
    current_user: CurrentUser,
    limit: int = 20,
    unread_only: bool = False,
) -> list[Notification]:
    query = db.query(Notification).filter(notification_visibility_filter(current_user))
    if current_user.role != "admin":
        query = query.filter(Notification.category != "security")
    if unread_only:
        query = query.filter(Notification.is_read.is_(False))
    return query.order_by(Notification.created_at.desc()).limit(max(1, min(limit, 100))).all()


def unread_notification_count(db: Session, *, current_user: CurrentUser) -> int:
    query = db.query(func.count(Notification.id)).filter(
        notification_visibility_filter(current_user),
        Notification.is_read.is_(False),
    )
    if current_user.role != "admin":
        query = query.filter(Notification.category != "security")
    return int(query.scalar() or 0)


def visible_notification(db: Session, *, notification_id: int, current_user: CurrentUser) -> Notification:
    query = db.query(Notification).filter(
        Notification.id == notification_id,
        notification_visibility_filter(current_user),
    )
    if current_user.role != "admin":
        query = query.filter(Notification.category != "security")
    notification = query.first()
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found.",
        )
    return notification


def mark_notification_read(db: Session, *, notification_id: int, current_user: CurrentUser) -> Notification:
    notification = visible_notification(db=db, notification_id=notification_id, current_user=current_user)
    notification.is_read = True
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


def mark_all_notifications_read(db: Session, *, current_user: CurrentUser) -> int:
    notifications = get_notifications_for_user(db=db, current_user=current_user, limit=100, unread_only=True)
    for notification in notifications:
        notification.is_read = True
        db.add(notification)
    db.commit()
    return len(notifications)


def notification_from_audit_log(db: Session, log: AuditLog) -> None:
    details = parse_details(log.details)
    source_id = int_detail(details, "order_id", "job_id", "audit_log_id")

    if log.action == "orders.order.created":
        create_notification(
            db,
            user_id=None,
            role_target="admin",
            title="New product request",
            message="A user submitted a new product request.",
            category="order",
            severity="info",
            source_service=log.service_name,
            source_action=log.action,
            source_id=source_id,
            commit=False,
        )
        return

    if log.action == "orders.order.approved":
        order_user_id = int_detail(details, "order_user_id", "requester_id") or log.user_id
        create_notification(
            db,
            user_id=order_user_id,
            role_target=None,
            title="Order approved",
            message="Your product request was approved.",
            category="order",
            severity="success",
            source_service=log.service_name,
            source_action=log.action,
            source_id=source_id,
            commit=False,
        )
        return

    if log.action == "orders.order.rejected":
        order_user_id = int_detail(details, "order_user_id", "requester_id") or log.user_id
        create_notification(
            db,
            user_id=order_user_id,
            role_target=None,
            title="Order rejected",
            message="Your product request was rejected.",
            category="order",
            severity="warning",
            source_service=log.service_name,
            source_action=log.action,
            source_id=source_id,
            commit=False,
        )
        return

    if log.action == "reports.job.completed":
        create_notification(
            db,
            user_id=None,
            role_target="admin",
            title="Report completed",
            message="A report job completed successfully.",
            category="report",
            severity="success",
            source_service=log.service_name,
            source_action=log.action,
            source_id=source_id,
            commit=False,
        )
        return

    if log.action == "reports.job.failed":
        create_notification(
            db,
            user_id=None,
            role_target="admin",
            title="Report failed",
            message="A report job failed.",
            category="report",
            severity="warning",
            source_service=log.service_name,
            source_action=log.action,
            source_id=source_id,
            commit=False,
        )

    if log.action in SECURITY_ACTIONS:
        if log.action.endswith("admin.denied"):
            title = "Admin access denied"
            message = "A blocked admin-only request was recorded."
            severity = "critical"
        else:
            title, message, severity = SECURITY_NOTIFICATION_META.get(
                log.action,
                ("Security alert", "A security-related audit event was recorded.", "warning"),
            )
        create_notification(
            db,
            user_id=None,
            role_target="admin",
            title=title,
            message=message,
            category="security",
            severity=severity,
            source_service=log.service_name,
            source_action=log.action,
            source_id=log.id,
            commit=False,
        )


def create_audit_log(db: Session, payload: AuditLogCreate) -> AuditLog:
    audit_status = payload.status.strip().lower()
    if audit_status not in ALLOWED_AUDIT_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported audit status.",
        )

    log = AuditLog(
        user_id=payload.user_id,
        action=payload.action.strip(),
        service_name=payload.service_name.strip(),
        ip_address=payload.ip_address.strip() if payload.ip_address else None,
        status=audit_status,
        details=payload.details,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    try:
        notification_from_audit_log(db, log)
        db.commit()
    except Exception as exc:
        db.rollback()
        print(f"Notification warning: could not derive notification for {log.action}: {exc.__class__.__name__}", flush=True)
    try:
        send_telegram_for_audit_log(log)
    except Exception as exc:
        print(f"Telegram warning: could not derive notification for {log.action}: {exc.__class__.__name__}", flush=True)
    return log


def list_audit_logs(
    db: Session,
    *,
    service_name: str | None = None,
    action: str | None = None,
    status_filter: str | None = None,
    user_id: int | None = None,
    limit: int = 100,
) -> list[AuditLog]:
    query = db.query(AuditLog)

    if service_name:
        query = query.filter(AuditLog.service_name == service_name.strip())
    if action:
        query = query.filter(AuditLog.action == action.strip())
    if status_filter:
        audit_status = status_filter.strip().lower()
        if audit_status not in ALLOWED_AUDIT_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported audit status.",
            )
        query = query.filter(AuditLog.status == audit_status)
    if user_id is not None:
        query = query.filter(AuditLog.user_id == user_id)

    return query.order_by(AuditLog.created_at.desc()).limit(max(1, min(limit, 500))).all()


def get_audit_log(db: Session, log_id: int) -> AuditLog:
    log = db.query(AuditLog).filter(AuditLog.id == log_id).first()
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audit log not found.",
        )
    return log


def delete_audit_log(db: Session, log_id: int) -> None:
    log = get_audit_log(db=db, log_id=log_id)
    db.query(DismissedSecurityAlert).filter(
        DismissedSecurityAlert.audit_log_id == log_id
    ).delete(synchronize_session=False)
    db.delete(log)
    db.commit()


def delete_user_risk_logs(db: Session, user_key: str) -> int:
    normalized_key = user_key.strip().lower()
    if normalized_key in {"0", "system"}:
        query = db.query(AuditLog).filter(AuditLog.user_id.is_(None))
    else:
        try:
            user_id = int(user_key)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User risk profile not found.",
            ) from exc
        query = db.query(AuditLog).filter(AuditLog.user_id == user_id)

    logs = query.all()
    if not logs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User risk profile not found.",
        )

    log_ids = [log.id for log in logs]
    db.query(DismissedSecurityAlert).filter(
        DismissedSecurityAlert.audit_log_id.in_(log_ids)
    ).delete(synchronize_session=False)
    deleted_count = query.delete(synchronize_session=False)
    db.commit()
    return int(deleted_count or 0)


def dismissed_alert_ids(db: Session) -> set[int]:
    rows = db.query(DismissedSecurityAlert.audit_log_id).all()
    return {int(row[0]) for row in rows}


def exclude_dismissed(logs: list[AuditLog], dismissed_ids: set[int]) -> list[AuditLog]:
    if not dismissed_ids:
        return logs
    return [log for log in logs if log.id not in dismissed_ids]


def dismiss_security_alert(
    db: Session,
    *,
    audit_log_id: int,
    dismissed_by: int | None,
    reason: str | None = None,
) -> DismissedSecurityAlert:
    get_audit_log(db=db, log_id=audit_log_id)
    clean_reason = reason.strip() if reason else None

    existing = (
        db.query(DismissedSecurityAlert)
        .filter(DismissedSecurityAlert.audit_log_id == audit_log_id)
        .first()
    )
    if existing:
        return existing

    dismissed = DismissedSecurityAlert(
        audit_log_id=audit_log_id,
        dismissed_by=dismissed_by,
        reason=clean_reason,
    )
    db.add(dismissed)
    db.flush()

    audit_event = AuditLogCreate(
        user_id=dismissed_by,
        action="security.alert.dismissed",
        service_name="audit-service",
        status="success",
        details=json.dumps({
            "dismissed_audit_log_id": audit_log_id,
            "reason": clean_reason,
        }),
    )
    create_audit_log(db=db, payload=audit_event)
    db.refresh(dismissed)
    return dismissed


def risk_level(score: int) -> str:
    if score >= 75:
        return "Critical"
    if score >= 50:
        return "High"
    if score >= 25:
        return "Medium"
    return "Low"


def action_count(db: Session, action: str) -> int:
    return db.query(func.count(AuditLog.id)).filter(AuditLog.action == action).scalar() or 0


def status_count(db: Session, audit_status: str) -> int:
    return db.query(func.count(AuditLog.id)).filter(AuditLog.status == audit_status).scalar() or 0


def table_count(db: Session, table_name: str, where_clause: str | None = None) -> int:
    statement = f"SELECT COUNT(*) FROM {table_name}"
    if where_clause:
        statement = f"{statement} WHERE {where_clause}"
    try:
        return int(db.execute(text(statement)).scalar() or 0)
    except Exception:
        return 0


def recent_security_logs(db: Session, limit: int = 100) -> list[AuditLog]:
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    logs = (
        db.query(AuditLog)
        .filter(
            AuditLog.created_at >= since,
            (AuditLog.action.in_(SECURITY_ACTIONS))
            | (AuditLog.status.in_(["blocked", "failure"])),
        )
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
        .all()
    )
    if logs:
        return logs

    return (
        db.query(AuditLog)
        .filter(
            (AuditLog.action.in_(SECURITY_ACTIONS))
            | (AuditLog.status.in_(["blocked", "failure"]))
        )
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
        .all()
    )


def calculate_risk_from_logs(logs: list[AuditLog]) -> tuple[int, str, list[dict[str, object]]]:
    factor_map: dict[str, dict[str, int]] = {}
    score = 0
    failed_login_count = 0
    unauthorized_count = 0
    admin_denied_count = 0
    ownership_denied_count = 0

    for log in logs:
        impact = RISK_IMPACTS.get(log.action, 0)
        if impact == 0 and log.status == "failure":
            impact = 5
        if impact == 0 and log.status == "blocked":
            impact = 10
        if impact <= 0:
            continue

        if log.action == "auth.login.failed":
            failed_login_count += 1
        if log.action == "auth.unauthorized":
            unauthorized_count += 1
        if log.action.endswith("admin.denied"):
            admin_denied_count += 1
        if log.action == "orders.ownership.denied":
            ownership_denied_count += 1

        label = log.action
        if label not in factor_map:
            factor_map[label] = {"count": 0, "impact": 0}
        factor_map[label]["count"] += 1
        factor_map[label]["impact"] += impact
        score += impact

    escalations = [
        ("Repeated failed logins", 25 if failed_login_count >= 10 else 15 if failed_login_count >= 5 else 0),
        ("Repeated unauthorized access", 20 if unauthorized_count >= 3 else 0),
        ("Repeated admin denials", 20 if admin_denied_count >= 3 else 0),
        ("Ownership violation attempt", 15 if ownership_denied_count >= 1 else 0),
    ]

    for label, impact in escalations:
        if impact <= 0:
            continue
        factor_map[label] = {"count": 1, "impact": impact}
        score += impact

    capped_score = min(score, 100)
    factors = [
        {"label": label, "count": values["count"], "impact": values["impact"]}
        for label, values in sorted(factor_map.items(), key=lambda item: item[1]["impact"], reverse=True)
    ]
    return capped_score, risk_level(capped_score), factors


def alert_severity(log: AuditLog) -> str:
    if log.action in {"orders.ownership.denied"}:
        return "critical"
    if log.action.endswith("admin.denied") or log.status == "blocked":
        return "high"
    if log.status == "failure":
        return "medium"
    return "low"


def severity_for_log(log: AuditLog) -> str:
    if log.action in {"orders.ownership.denied", "inventory.stock.deduct.failed"}:
        return "Critical"
    if log.action == "auth.login.failed" or log.status == "failure":
        return "Medium"
    if log.action == "auth.unauthorized" or log.action.endswith("admin.denied") or log.status == "blocked":
        return "High"
    return "Low"


def alert_from_log(log: AuditLog) -> dict[str, object]:
    return {
        "id": log.id,
        "audit_log_id": log.id,
        "title": ALERT_TITLES.get(log.action, "Security event detected"),
        "severity": alert_severity(log),
        "source_service": log.service_name,
        "action": log.action,
        "user_id": log.user_id,
        "ip_address": log.ip_address,
        "created_at": log.created_at,
        "details": log.details,
    }


def monitoring_summary(db: Session) -> dict[str, object]:
    dismissed_ids = dismissed_alert_ids(db)
    security_logs = exclude_dismissed(recent_security_logs(db), dismissed_ids)
    score, level, _ = calculate_risk_from_logs(security_logs)

    return {
        "total_users": table_count(db, "users"),
        "total_products": table_count(db, "products"),
        "total_orders": table_count(db, "orders"),
        "pending_orders": table_count(db, "orders", "status = 'pending'"),
        "approved_orders": table_count(db, "orders", "status = 'approved'"),
        "rejected_orders": table_count(db, "orders", "status = 'rejected'"),
        "total_report_jobs": table_count(db, "jobs"),
        "completed_report_jobs": table_count(db, "jobs", "status = 'completed'"),
        "failed_report_jobs": table_count(db, "jobs", "status = 'failed'"),
        "total_audit_logs": db.query(func.count(AuditLog.id)).scalar() or 0,
        "failed_logins": sum(1 for log in security_logs if log.action == "auth.login.failed"),
        "unauthorized_attempts": sum(1 for log in security_logs if log.action == "auth.unauthorized"),
        "admin_denied_attempts": sum(1 for log in security_logs if log.action.endswith("admin.denied")),
        "worker_completed_jobs": action_count(db, "reports.job.completed"),
        "risk_score": score,
        "risk_level": level,
    }


def security_overview(db: Session) -> dict[str, object]:
    dismissed_ids = dismissed_alert_ids(db)
    logs = exclude_dismissed(recent_security_logs(db), dismissed_ids)
    score, level, factors = calculate_risk_from_logs(logs)
    alerts = [alert_from_log(log) for log in logs[:20]]

    return {
        "risk_score": score,
        "risk_level": level,
        "failed_logins": sum(1 for log in logs if log.action == "auth.login.failed"),
        "unauthorized_attempts": sum(1 for log in logs if log.action == "auth.unauthorized"),
        "admin_denied_attempts": sum(1 for log in logs if log.action.endswith("admin.denied")),
        "risk_factors": factors,
        "alerts": alerts,
        "recent_security_events": [
            {
                "id": log.id,
                "action": log.action,
                "service_name": log.service_name,
                "user_id": log.user_id,
                "ip_address": log.ip_address,
                "status": log.status,
                "details": log.details,
                "created_at": log.created_at,
            }
            for log in logs[:20]
        ],
    }


def security_charts(db: Session) -> dict[str, object]:
    since = datetime.now(timezone.utc) - timedelta(days=7)
    dismissed_ids = dismissed_alert_ids(db)
    logs = (
        db.query(AuditLog)
        .filter(AuditLog.created_at >= since)
        .order_by(AuditLog.created_at.asc())
        .all()
    )
    if not logs:
        logs = db.query(AuditLog).order_by(AuditLog.created_at.asc()).limit(100).all()
    logs = exclude_dismissed(logs, dismissed_ids)

    grouped: dict[str, list[AuditLog]] = defaultdict(list)
    status_distribution = {"Success": 0, "Failure": 0, "Blocked": 0, "Info": 0}
    severity_distribution = {"Low": 0, "Medium": 0, "High": 0, "Critical": 0}

    for log in logs:
        label = log.created_at.strftime("%b %d")
        grouped[label].append(log)
        status_distribution[log.status.title()] = status_distribution.get(log.status.title(), 0) + 1
        severity = severity_for_log(log)
        severity_distribution[severity] = severity_distribution.get(severity, 0) + 1

    labels = list(grouped.keys())[-7:]
    events_over_time = []
    risk_score_trend = []

    for label in labels:
        day_logs = grouped[label]
        success = sum(1 for log in day_logs if log.status == "success")
        failure = sum(1 for log in day_logs if log.status == "failure")
        blocked = sum(1 for log in day_logs if log.status == "blocked")
        info = sum(1 for log in day_logs if log.status == "info")
        risk_score, _, _ = calculate_risk_from_logs(day_logs)
        events_over_time.append({
            "label": label,
            "success": success,
            "failure": failure,
            "blocked": blocked,
            "info": info,
            "total": success + failure + blocked + info,
        })
        risk_score_trend.append({
            "label": label,
            "risk_score": risk_score,
        })

    return {
        "events_over_time": events_over_time,
        "risk_score_trend": risk_score_trend,
        "severity_breakdown": [
            {"label": label, "value": value}
            for label, value in severity_distribution.items()
        ],
        "status_distribution": [
            {"label": label, "value": value}
            for label, value in status_distribution.items()
        ],
    }


def user_lookup(db: Session) -> dict[int, dict[str, str | None]]:
    try:
        rows = db.execute(text("SELECT id, name, email FROM users")).mappings().all()
    except Exception:
        return {}

    return {
        int(row["id"]): {
            "user_name": row.get("name") or row.get("email"),
            "user_email": row.get("email"),
        }
        for row in rows
    }


def user_risk_score_from_logs(
    user_id: int | None,
    logs: list[AuditLog],
    users: dict[int, dict[str, str | None]],
) -> dict[str, object]:
    score, level, _ = calculate_risk_from_logs(logs)
    failed_logins = sum(1 for log in logs if log.action == "auth.login.failed")
    unauthorized_attempts = sum(1 for log in logs if log.action == "auth.unauthorized")
    admin_denied_attempts = sum(1 for log in logs if log.action.endswith("admin.denied"))
    ownership_denied_attempts = sum(1 for log in logs if log.action == "orders.ownership.denied")
    security_events = [
        log for log in logs
        if log.action in SECURITY_ACTIONS or log.status in {"blocked", "failure"}
    ]
    user_info = users.get(user_id or 0, {})

    return {
        "user_id": user_id,
        "user_name": user_info.get("user_name") if user_id is not None else "System / Unknown",
        "user_email": user_info.get("user_email") if user_id is not None else None,
        "risk_score": score,
        "risk_level": level,
        "failed_logins": failed_logins,
        "unauthorized_attempts": unauthorized_attempts,
        "admin_denied_attempts": admin_denied_attempts,
        "ownership_denied_attempts": ownership_denied_attempts,
        "total_security_events": len(security_events),
        "last_event_at": max((log.created_at for log in logs), default=None),
    }


def user_risk_scores(
    db: Session,
    *,
    limit: int = 20,
    risk_level_filter: str | None = None,
) -> list[dict[str, object]]:
    dismissed_ids = dismissed_alert_ids(db)
    logs = exclude_dismissed(
        db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(500).all(),
        dismissed_ids,
    )
    grouped: dict[int | None, list[AuditLog]] = defaultdict(list)

    for log in logs:
        grouped[log.user_id].append(log)

    users = user_lookup(db)
    scores = [
        user_risk_score_from_logs(user_id, user_logs, users)
        for user_id, user_logs in grouped.items()
    ]

    if risk_level_filter:
        normalized_level = risk_level_filter.strip().title()
        if normalized_level not in {"Low", "Medium", "High", "Critical"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported risk level.",
            )
        scores = [score for score in scores if score["risk_level"] == normalized_level]

    scores.sort(key=lambda item: int(item["risk_score"]), reverse=True)
    return scores[:max(1, min(limit, 100))]


def user_risk_details(db: Session, user_key: str) -> dict[str, object]:
    normalized_key = user_key.strip().lower()
    if normalized_key in {"0", "system"}:
        user_id: int | None = None
    else:
        try:
            user_id = int(user_key)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User risk profile not found.",
            ) from exc

    query = db.query(AuditLog)
    if user_id is None:
        query = query.filter(AuditLog.user_id.is_(None))
    else:
        query = query.filter(AuditLog.user_id == user_id)

    logs = exclude_dismissed(
        query.order_by(AuditLog.created_at.desc()).limit(100).all(),
        dismissed_alert_ids(db),
    )
    if not logs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User risk profile not found.",
        )

    users = user_lookup(db)
    summary = user_risk_score_from_logs(user_id, logs, users)
    action_counts: dict[str, int] = defaultdict(int)
    for log in logs:
        action_counts[log.action] += 1

    return {
        "summary": summary,
        "recent_audit_logs": [
            {
                "id": log.id,
                "user_id": log.user_id,
                "action": log.action,
                "service_name": log.service_name,
                "ip_address": log.ip_address,
                "status": log.status,
                "details": log.details,
                "created_at": log.created_at,
            }
            for log in logs[:20]
        ],
        "top_risk_actions": [
            {"action": action, "count": count}
            for action, count in sorted(action_counts.items(), key=lambda item: item[1], reverse=True)[:10]
        ],
    }
