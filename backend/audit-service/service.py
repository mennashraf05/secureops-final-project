from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from models import ALLOWED_AUDIT_STATUSES, AuditLog
from schemas import AuditLogCreate


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
