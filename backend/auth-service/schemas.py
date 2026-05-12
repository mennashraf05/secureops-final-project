from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


def validate_non_blank(value: str) -> str:
    if not value.strip():
        raise ValueError("Field cannot be blank.")
    return value


def validate_strong_password(value: str) -> str:
    has_lower = any(char.islower() for char in value)
    has_upper = any(char.isupper() for char in value)
    has_number_or_symbol = any(not char.isalpha() for char in value)
    if not has_lower or not has_upper or not has_number_or_symbol:
        raise ValueError("Password must include uppercase, lowercase, and a number or symbol.")
    return value


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)

    model_config = ConfigDict(str_strip_whitespace=True)

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, value: str) -> str:
        return validate_non_blank(value)

    @field_validator("password")
    @classmethod
    def password_is_strong(cls, value: str) -> str:
        return validate_strong_password(value)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class VerifyCodeRequest(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")
    remember_me: bool = False


class SetPasswordRequest(VerifyCodeRequest):
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def password_is_strong(cls, value: str) -> str:
        return validate_strong_password(value)


class VerifyTotpSetupRequest(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")
    remember_me: bool = False


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class AdminCreateUserRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    email: EmailStr
    role: str = Field(..., pattern="^(admin|user)$")

    model_config = ConfigDict(str_strip_whitespace=True)

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, value: str) -> str:
        return validate_non_blank(value)


class ProfileUpdateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)

    model_config = ConfigDict(str_strip_whitespace=True)

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, value: str) -> str:
        return validate_non_blank(value)


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def password_is_strong(cls, value: str) -> str:
        return validate_strong_password(value)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def password_is_strong(cls, value: str) -> str:
        return validate_strong_password(value)


class UserResponse(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str
    is_active: bool
    email_verified: bool
    two_factor_enabled: bool
    two_factor_required: bool
    two_factor_method: str
    created_at: datetime
    roles: list[str] = []
    permissions_count: int = 0

    model_config = {"from_attributes": True}


class UsersListResponse(BaseModel):
    success: bool
    message: str
    data: list[UserResponse]


class UserActionResponse(BaseModel):
    success: bool
    message: str
    data: UserResponse | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse


class AuthFlowResponse(BaseModel):
    success: bool
    message: str
    data: dict | None = None


class MessageResponse(BaseModel):
    success: bool
    message: str
    data: dict | None = None
