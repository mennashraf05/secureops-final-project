from fastapi import Depends, FastAPI, HTTPException, Query
from sqlalchemy.orm import Session

from dependencies import CurrentUser, require_admin, require_internal_api_key
from schemas import (
    AuditLogActionResponse,
    AuditLogCreate,
    AuditLogListResponse,
    AuditLogResponse,
    DismissSecurityAlertRequest,
    DismissedSecurityAlertResponse,
)
from seed import seed_audit_service
from service import (
    create_audit_log,
    delete_audit_log,
    dismiss_security_alert,
    get_audit_log,
    list_audit_logs,
    monitoring_summary,
    security_charts,
    security_overview,
    user_risk_details,
    user_risk_scores,
)
from shared.database import Base, SessionLocal, engine, get_db
from shared.errors import safe_exception_handler, safe_http_exception_handler
from shared.responses import success_response


SERVICE_NAME = "audit-service"

app = FastAPI(title="SecureOps Audit Service")
app.add_exception_handler(Exception, safe_exception_handler)
app.add_exception_handler(HTTPException, safe_http_exception_handler)


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
    service_name: str | None = Query(default=None),
    action: str | None = Query(default=None),
    status: str | None = Query(default=None),
    user_id: int | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
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


@app.get("/audit/logs/{log_id}", response_model=AuditLogActionResponse)
def log(
    log_id: int,
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    audit_log = get_audit_log(db=db, log_id=log_id)
    return success_response("Audit log retrieved successfully.", AuditLogResponse.model_validate(audit_log))


@app.delete("/audit/logs/{log_id}")
def delete_log(
    log_id: int,
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
    audit_log_id: int,
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
    risk_level: str | None = Query(default=None),
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    return success_response(
        "User risk scores retrieved successfully.",
        user_risk_scores(db, limit=limit, risk_level_filter=risk_level),
    )


@app.get("/audit/security/user-risk/{user_id}")
def user_risk_details_endpoint(
    user_id: str,
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    return success_response(
        "User risk details retrieved successfully.",
        user_risk_details(db, user_id),
    )
