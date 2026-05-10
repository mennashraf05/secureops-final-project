from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class VerifyCodeRequest(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")


class SetPasswordRequest(VerifyCodeRequest):
    password: str = Field(..., min_length=8, max_length=128)


class VerifyTotpSetupRequest(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class AdminCreateUserRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    email: EmailStr
    role: str = Field(..., pattern="^(admin|user)$")


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
