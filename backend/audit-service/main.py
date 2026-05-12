import json

from fastapi import Depends, FastAPI, HTTPException, Path, Query, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from dependencies import CurrentUser, get_current_user, require_admin, require_internal_api_key
from schemas import (
    AuditLogActionResponse,
    AuditLogCreate,
    AuditLogListResponse,
    AuditLogResponse,
    DismissSecurityAlertRequest,
    DismissedSecurityAlertResponse,
    NotificationActionResponse,
    NotificationListResponse,
    NotificationResponse,
    NotificationSettingsActionResponse,
    NotificationSettingsResponse,
    NotificationUnreadCountResponse,
    UpdateNotificationSettingsRequest,
)
from seed import seed_audit_service
from service import (
    create_audit_log,
    delete_audit_log,
    delete_user_risk_logs,
    dismiss_security_alert,
    get_audit_log,
    get_notifications_for_user,
    list_audit_logs,
    mark_all_notifications_read,
    mark_notification_read,
    monitoring_summary,
    unread_notification_count,
    security_charts,
    security_overview,
    user_risk_details,
    user_risk_scores,
)
from shared.database import Base, SessionLocal, engine, get_db
from shared.errors import safe_exception_handler, safe_http_exception_handler
from shared.responses import success_response
from telegram_service import (
    set_telegram_admin_notifications_enabled,
    telegram_notification_settings,
)


SERVICE_NAME = "audit-service"

app = FastAPI(title="SecureOps Audit Service")
app.add_exception_handler(Exception, safe_exception_handler)
app.add_exception_handler(HTTPException, safe_http_exception_handler)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "message": "Invalid request data.",
            "data": None,
        },
    )


def health_response() -> dict[str, str]:
    return {"service": SERVICE_NAME, "status": "healthy"}


@app.on_event("startup")
def startup() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_audit_service(db)
    finally:
        db.close()


@app.get("/health")
def health() -> dict[str, str]:
    return health_response()


@app.get("/audit/health")
def audit_gateway_health() -> dict[str, str]:
    return health_response()


@app.get("/security/health")
def security_gateway_health() -> dict[str, str]:
    return health_response()


@app.post("/audit/events", response_model=AuditLogActionResponse, status_code=201)
def record_event(
    payload: AuditLogCreate,
    internal_auth: None = Depends(require_internal_api_key),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    log = create_audit_log(db=db, payload=payload)
    return success_response("Audit event recorded successfully.", AuditLogResponse.model_validate(log))


@app.get("/audit/logs", response_model=AuditLogListResponse)
def logs(
    service_name: str | None = Query(default=None, min_length=1, max_length=80),
    action: str | None = Query(default=None, min_length=1, max_length=160),
    status: str | None = Query(default=None, pattern="^(success|failure|blocked|info)$"),
    user_id: int | None = Query(default=None, gt=0),
    limit: int = Query(default=100, ge=1, le=100),
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    audit_logs = [
        AuditLogResponse.model_validate(log)
        for log in list_audit_logs(
            db=db,
            service_name=service_name,
            action=action,
            status_filter=status,
            user_id=user_id,
            limit=limit,
        )
    ]
    return success_response("Audit logs retrieved successfully.", audit_logs)


@app.get("/audit/notifications", response_model=NotificationListResponse)
def notifications(
    limit: int = Query(default=20, ge=1, le=100),
    unread_only: bool = Query(default=False),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    items = [
        NotificationResponse.model_validate(notification)
        for notification in get_notifications_for_user(
            db=db,
            current_user=current_user,
            limit=limit,
            unread_only=unread_only,
        )
    ]
    return success_response("Notifications retrieved successfully.", items)


@app.get("/audit/notifications/unread-count", response_model=NotificationUnreadCountResponse)
def notification_unread_count(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    count = unread_notification_count(db=db, current_user=current_user)
    return success_response("Unread notification count retrieved successfully.", {"count": count})


@app.patch("/audit/notifications/{notification_id}/read", response_model=NotificationActionResponse)
def read_notification(
    notification_id: int = Path(..., gt=0),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    notification = mark_notification_read(
        db=db,
        notification_id=notification_id,
        current_user=current_user,
    )
    return success_response("Notification marked as read.", NotificationResponse.model_validate(notification))


@app.patch("/audit/notifications/read-all")
def read_all_notifications(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    updated_count = mark_all_notifications_read(db=db, current_user=current_user)
    return success_response("Notifications marked as read.", {"updated_count": updated_count})


@app.get("/audit/settings/notifications", response_model=NotificationSettingsActionResponse)
def notification_settings(
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    return success_response(
        "Notification settings retrieved successfully.",
        NotificationSettingsResponse.model_validate(telegram_notification_settings(db)),
    )


@app.patch("/audit/settings/notifications", response_model=NotificationSettingsActionResponse)
def update_notification_settings(
    payload: UpdateNotificationSettingsRequest,
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    set_telegram_admin_notifications_enabled(
        db=db,
        enabled=payload.telegram_admin_notifications_enabled,
    )
    audit_event = AuditLogCreate(
        user_id=current_user.id,
        action="settings.telegram_notifications.updated",
        service_name=SERVICE_NAME,
        status="success",
        details=json.dumps(
            {
                "telegram_admin_notifications_enabled": payload.telegram_admin_notifications_enabled,
            }
        ),
    )
    create_audit_log(db=db, payload=audit_event)
    return success_response(
        "Notification settings updated successfully.",
        NotificationSettingsResponse.model_validate(telegram_notification_settings(db)),
    )


@app.get("/audit/logs/{log_id}", response_model=AuditLogActionResponse)
def log(
    log_id: int = Path(..., gt=0),
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    audit_log = get_audit_log(db=db, log_id=log_id)
    return success_response("Audit log retrieved successfully.", AuditLogResponse.model_validate(audit_log))


@app.delete("/audit/logs/{log_id}")
def delete_log(
    log_id: int = Path(..., gt=0),
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    delete_audit_log(db=db, log_id=log_id)
    return success_response("Audit log deleted successfully.")


@app.get("/audit/monitoring/summary")
def monitoring_summary_endpoint(
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    return success_response("Monitoring summary retrieved successfully.", monitoring_summary(db))


@app.get("/audit/security/overview")
def security_overview_endpoint(
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    return success_response("Security overview retrieved successfully.", security_overview(db))


@app.post("/audit/security/alerts/{audit_log_id}/dismiss")
def dismiss_security_alert_endpoint(
    audit_log_id: int = Path(..., gt=0),
    payload: DismissSecurityAlertRequest | None = None,
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    dismissed = dismiss_security_alert(
        db=db,
        audit_log_id=audit_log_id,
        dismissed_by=current_user.id,
        reason=payload.reason if payload else None,
    )
    return success_response(
        "Security alert dismissed successfully.",
        DismissedSecurityAlertResponse.model_validate(dismissed),
    )


@app.get("/audit/security/charts")
def security_charts_endpoint(
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    return success_response("Security chart data retrieved successfully.", security_charts(db))


@app.get("/audit/security/user-risk")
def user_risk_scores_endpoint(
    limit: int = Query(default=20, ge=1, le=100),
    risk_level: str | None = Query(default=None, pattern="^(Low|Medium|High|Critical)$"),
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    return success_response(
        "User risk scores retrieved successfully.",
        user_risk_scores(db, limit=limit, risk_level_filter=risk_level),
    )


@app.get("/audit/security/user-risk/{user_id}")
def user_risk_details_endpoint(
    user_id: str = Path(..., min_length=1, max_length=30),
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    return success_response(
        "User risk details retrieved successfully.",
        user_risk_details(db, user_id),
    )


@app.delete("/audit/security/user-risk/{user_id}")
def delete_user_risk_endpoint(
    user_id: str = Path(..., min_length=1, max_length=30),
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    deleted_count = delete_user_risk_logs(db=db, user_key=user_id)
    return success_response(
        "User risk events deleted successfully.",
        {"deleted_count": deleted_count},
    )
