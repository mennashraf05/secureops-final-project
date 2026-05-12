from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Path as PathParam, Query, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from dependencies import CurrentUser, require_admin
from rabbitmq_client import ReportQueueError, publish_report_job
from schemas import ReportJobActionResponse, ReportJobCreate, ReportJobListResponse, ReportJobResponse
from seed import seed_report_service
from service import create_report_job, get_report_job, list_report_jobs, mark_job_failed
from shared.audit_client import send_audit_event
from shared.database import Base, SessionLocal, engine, get_db
from shared.errors import safe_exception_handler, safe_http_exception_handler
from shared.request_utils import get_client_ip
from shared.responses import success_response


SERVICE_NAME = "report-service"
REPORTS_DIR = Path("/app/reports")

app = FastAPI(title="SecureOps Report Service")
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
        seed_report_service(db)
    finally:
        db.close()


@app.get("/health")
def health() -> dict[str, str]:
    return health_response()


@app.get("/reports/health")
def gateway_health() -> dict[str, str]:
    return health_response()


def queue_report_job(
    *,
    request: Request,
    db: Session,
    current_user: CurrentUser,
    job_type: str,
    success_message: str,
    audit_action: str,
) -> dict[str, object]:
    job = create_report_job(
        db=db,
        payload=ReportJobCreate(type=job_type),
        requested_by=current_user.id,
    )
    try:
        publish_report_job(job)
    except ReportQueueError as exc:
        mark_job_failed(db, job, "Report queue is unavailable.")
        send_audit_event(
            "reports.job.failed",
            SERVICE_NAME,
            "failure",
            user_id=current_user.id,
            ip_address=get_client_ip(request),
            details={"job_id": job.id, "type": job.type, "reason": "queue_unavailable"},
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not queue report job.",
        ) from exc

    send_audit_event(
        "reports.job.created",
        SERVICE_NAME,
        "success",
        user_id=current_user.id,
        ip_address=get_client_ip(request),
        details={"job_id": job.id, "type": job.type},
    )
    send_audit_event(
        audit_action,
        SERVICE_NAME,
        "success",
        user_id=current_user.id,
        ip_address=get_client_ip(request),
        details={"job_id": job.id, "type": job.type},
    )
    return success_response(success_message, ReportJobResponse.model_validate(job))


@app.post("/reports/inventory", response_model=ReportJobActionResponse, status_code=201)
def request_inventory_report(
    request: Request,
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    return queue_report_job(
        request=request,
        db=db,
        current_user=current_user,
        job_type="inventory_report",
        success_message="Inventory report job created successfully.",
        audit_action="reports.inventory.created",
    )


@app.post("/reports/low-stock", response_model=ReportJobActionResponse, status_code=201)
def request_low_stock_report(
    request: Request,
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    return queue_report_job(
        request=request,
        db=db,
        current_user=current_user,
        job_type="low_stock_report",
        success_message="Low stock report job created successfully.",
        audit_action="reports.low_stock.created",
    )


@app.post("/reports/security", response_model=ReportJobActionResponse, status_code=201)
def request_security_report(
    request: Request,
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    return queue_report_job(
        request=request,
        db=db,
        current_user=current_user,
        job_type="security_report",
        success_message="Security report job created successfully.",
        audit_action="reports.security.created",
    )


@app.post("/reports/audit", response_model=ReportJobActionResponse, status_code=201)
def request_audit_report(
    request: Request,
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    return queue_report_job(
        request=request,
        db=db,
        current_user=current_user,
        job_type="audit_report",
        success_message="Audit report job created successfully.",
        audit_action="reports.audit.created",
    )


@app.get("/reports/jobs", response_model=ReportJobListResponse)
def jobs(
    status: str | None = Query(default=None, pattern="^(pending|processing|completed|failed)$"),
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    report_jobs = [
        ReportJobResponse.model_validate(job)
        for job in list_report_jobs(db=db, status_filter=status)
    ]
    return success_response("Report jobs retrieved successfully.", report_jobs)


@app.get("/reports/jobs/{job_id}", response_model=ReportJobActionResponse)
def job(
    job_id: int = PathParam(..., gt=0),
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    report_job = get_report_job(db=db, job_id=job_id)
    return success_response("Report job retrieved successfully.", ReportJobResponse.model_validate(report_job))


@app.get("/reports/jobs/{job_id}/download")
def download_report(
    job_id: int = PathParam(..., gt=0),
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> FileResponse:
    report_job = get_report_job(db=db, job_id=job_id)

    if report_job.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Report job is not ready for download.",
        )

    if not report_job.result_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report file not found.",
        )

    reports_root = REPORTS_DIR.resolve()
    report_path = Path(report_job.result_path).resolve()

    try:
        report_path.relative_to(reports_root)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report file not found.",
        ) from exc

    if not report_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report file not found.",
        )

    safe_type = report_job.type if report_job.type in {
        "inventory_report",
        "low_stock_report",
        "security_report",
        "audit_report",
    } else "inventory_report"
    filename = f"{safe_type}_job_{report_job.id}.txt"
    return FileResponse(
        path=report_path,
        media_type="text/plain",
        filename=filename,
    )
