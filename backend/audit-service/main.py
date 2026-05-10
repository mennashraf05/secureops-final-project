from fastapi import Depends, FastAPI, HTTPException, Query
from sqlalchemy.orm import Session

from dependencies import CurrentUser, require_admin, require_internal_api_key
from schemas import AuditLogActionResponse, AuditLogCreate, AuditLogListResponse, AuditLogResponse
from seed import seed_audit_service
from service import create_audit_log, get_audit_log, list_audit_logs
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
