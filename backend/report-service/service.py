from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from models import ALLOWED_JOB_STATUSES, Job
from schemas import ReportJobCreate, validate_job_type


def create_report_job(db: Session, payload: ReportJobCreate, requested_by: int) -> Job:
    try:
        job_type = validate_job_type(payload.type)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    job = Job(
        type=job_type,
        status="pending",
        requested_by=requested_by,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def list_report_jobs(db: Session, status_filter: str | None = None) -> list[Job]:
    query = db.query(Job)
    if status_filter:
        status_value = status_filter.strip().lower()
        if status_value not in ALLOWED_JOB_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported job status.",
            )
        query = query.filter(Job.status == status_value)

    return query.order_by(Job.created_at.desc()).all()


def get_report_job(db: Session, job_id: int) -> Job:
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report job not found.",
        )
    return job


def mark_job_failed(db: Session, job: Job, message: str) -> Job:
    job.status = "failed"
    job.error_message = message
    job.completed_at = datetime.now(timezone.utc)
    db.add(job)
    db.commit()
    db.refresh(job)
    return job
