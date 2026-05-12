from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, StrictBool, field_validator


ALLOWED_AUDIT_STATUSES = {"success", "failure", "blocked", "info"}


def non_blank(value: str) -> str:
    if not value.strip():
        raise ValueError("Field cannot be blank.")
    return value


class AuditLogCreate(BaseModel):
    user_id: int | None = Field(default=None, gt=0)
    action: str = Field(min_length=1, max_length=160)
    service_name: str = Field(min_length=1, max_length=80)
    ip_address: str | None = Field(default=None, max_length=80)
    status: str = Field(min_length=1, max_length=30)
    details: str | None = None

    model_config = ConfigDict(str_strip_whitespace=True)

    @field_validator("action", "service_name")
    @classmethod
    def text_not_blank(cls, value: str) -> str:
        return non_blank(value)

    @field_validator("status")
    @classmethod
    def status_allowed(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in ALLOWED_AUDIT_STATUSES:
            raise ValueError("Unsupported audit status.")
        return normalized


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

    model_config = ConfigDict(str_strip_whitespace=True)

    @field_validator("reason")
    @classmethod
    def blank_reason_to_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class DismissedSecurityAlertResponse(BaseModel):
    id: int
    audit_log_id: int
    dismissed_by: int | None
    reason: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationResponse(BaseModel):
    id: int
    user_id: int | None
    role_target: str | None
    title: str
    message: str
    category: str
    severity: str
    source_service: str | None
    source_action: str | None
    source_id: int | None
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationListResponse(BaseModel):
    success: bool
    message: str
    data: list[NotificationResponse]


class NotificationActionResponse(BaseModel):
    success: bool
    message: str
    data: NotificationResponse


class NotificationUnreadCountResponse(BaseModel):
    success: bool
    message: str
    data: dict[str, int]


class MarkReadRequest(BaseModel):
    is_read: StrictBool = True


class NotificationSettingsResponse(BaseModel):
    telegram_admin_notifications_enabled: bool
    telegram_env_configured: bool
    telegram_global_enabled: bool
    telegram_target: str
    telegram_token_visible: bool
    telegram_chat_id_visible: bool


class NotificationSettingsActionResponse(BaseModel):
    success: bool
    message: str
    data: NotificationSettingsResponse


class UpdateNotificationSettingsRequest(BaseModel):
    telegram_admin_notifications_enabled: StrictBool
