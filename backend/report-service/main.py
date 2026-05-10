from fastapi import Depends, FastAPI, HTTPException, status
from sqlalchemy.orm import Session

from dependencies import CurrentUser, require_admin
from rabbitmq_client import ReportQueueError, publish_report_job
from schemas import ReportJobActionResponse, ReportJobCreate, ReportJobListResponse, ReportJobResponse
from seed import seed_report_service
from service import create_report_job, get_report_job, list_report_jobs, mark_job_failed
from shared.database import Base, SessionLocal, engine, get_db
from shared.errors import safe_exception_handler, safe_http_exception_handler
from shared.responses import success_response


SERVICE_NAME = "report-service"

app = FastAPI(title="SecureOps Report Service")
app.add_exception_handler(Exception, safe_exception_handler)
app.add_exception_handler(HTTPException, safe_http_exception_handler)


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


@app.post("/reports/inventory", response_model=ReportJobActionResponse, status_code=201)
def request_inventory_report(
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    job = create_report_job(
        db=db,
        payload=ReportJobCreate(type="inventory_report"),
        requested_by=current_user.id,
    )
    try:
        publish_report_job(job)
    except ReportQueueError as exc:
        mark_job_failed(db, job, "Report queue is unavailable.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not queue report job.",
        ) from exc

    return success_response("Inventory report job created successfully.", ReportJobResponse.model_validate(job))


@app.get("/reports/jobs", response_model=ReportJobListResponse)
def jobs(
    status: str | None = None,
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
    job_id: int,
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    report_job = get_report_job(db=db, job_id=job_id)
    return success_response("Report job retrieved successfully.", ReportJobResponse.model_validate(report_job))
