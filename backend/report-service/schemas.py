from datetime import datetime

from pydantic import BaseModel, Field

from models import ALLOWED_JOB_STATUSES, ALLOWED_JOB_TYPES


class ReportJobCreate(BaseModel):
    type: str = Field(default="inventory_report", pattern="^(inventory_report|low_stock_report)$")


class ReportJobResponse(BaseModel):
    id: int
    type: str
    status: str
    requested_by: int | None
    result_path: str | None
    error_message: str | None
    created_at: datetime
    completed_at: datetime | None

    model_config = {"from_attributes": True}


class ReportJobActionResponse(BaseModel):
    success: bool
    message: str
    data: ReportJobResponse


class ReportJobListResponse(BaseModel):
    success: bool
    message: str
    data: list[ReportJobResponse]


class ReportStatusQuery(BaseModel):
    status: str | None = None

    def normalized_status(self) -> str | None:
        if self.status is None:
            return None
        status = self.status.strip().lower()
        if status not in ALLOWED_JOB_STATUSES:
            raise ValueError("Unsupported job status.")
        return status


def validate_job_type(job_type: str) -> str:
    normalized_type = job_type.strip().lower()
    if normalized_type not in ALLOWED_JOB_TYPES:
        raise ValueError("Unsupported job type.")
    return normalized_type
