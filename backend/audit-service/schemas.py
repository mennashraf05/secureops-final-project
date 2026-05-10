from datetime import datetime

from pydantic import BaseModel, Field


class AuditLogCreate(BaseModel):
    user_id: int | None = None
    action: str = Field(min_length=1, max_length=160)
    service_name: str = Field(min_length=1, max_length=80)
    ip_address: str | None = Field(default=None, max_length=80)
    status: str = Field(min_length=1, max_length=30)
    details: str | None = None


class AuditLogResponse(BaseModel):
    id: int
    user_id: int | None
    action: str
    service_name: str
    ip_address: str | None
    status: str
    details: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditLogActionResponse(BaseModel):
    success: bool
    message: str
    data: AuditLogResponse


class AuditLogListResponse(BaseModel):
    success: bool
    message: str
    data: list[AuditLogResponse]


class DismissSecurityAlertRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=1000)


class DismissedSecurityAlertResponse(BaseModel):
    id: int
    audit_log_id: int
    dismissed_by: int | None
    reason: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
