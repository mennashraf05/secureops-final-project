from urllib.parse import urlencode

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import RedirectResponse
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from dependencies import AuthContext, get_current_auth_context, get_current_user, require_admin
from schemas import AdminCreateUserRequest, AuthFlowResponse, ForgotPasswordRequest, LoginRequest, MessageResponse, PasswordChangeRequest, ProfileUpdateRequest, RegisterRequest, ResendVerificationRequest, ResetPasswordRequest, SetPasswordRequest, TokenResponse, UserActionResponse, UserResponse, UsersListResponse, VerifyCodeRequest, VerifyTotpSetupRequest
from seed import seed_default_users
from service import authenticate_user, backfill_user_roles, change_own_password, complete_github_oauth_login, create_github_oauth_state, create_user_by_admin, delete_user_by_admin, github_callback_redirect, list_users, logout_user, oauth_configured, register_user, request_password_reset, resend_verification_code, reset_password_with_code, set_password_with_code, update_own_profile, user_response, verify_email_code, verify_login_2fa, verify_totp_setup
from shared.config import settings
from shared.database import Base, SessionLocal, engine, get_db
from shared.errors import safe_exception_handler, safe_http_exception_handler
from shared.request_utils import get_client_ip
from shared.responses import success_response


SERVICE_NAME = "auth-service"

app = FastAPI(title="SecureOps Auth Service")
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


def run_local_migrations() -> None:
    statements = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT TRUE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_required BOOLEAN NOT NULL DEFAULT TRUE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_method VARCHAR(30) NOT NULL DEFAULT 'authenticator'",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret VARCHAR(64)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_confirmed BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_provider VARCHAR(50)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_id VARCHAR(255)",
    ]
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))
        connection.execute(text("UPDATE users SET two_factor_method = 'authenticator' WHERE two_factor_method = 'email'"))


@app.on_event("startup")
def startup() -> None:
    Base.metadata.create_all(bind=engine)
    run_local_migrations()
    db = SessionLocal()
    try:
        seed_default_users(db)
        backfill_user_roles(db)
    finally:
        db.close()


@app.get("/health")
def health() -> dict[str, str]:
    return health_response()


@app.get("/auth/health")
def gateway_health() -> dict[str, str]:
    return health_response()


@app.post("/auth/register", response_model=AuthFlowResponse, status_code=201)
def register(payload: RegisterRequest, request: Request, db: Session = Depends(get_db)) -> dict[str, object]:
    return success_response(
        "Registration successful. Please verify your email.",
        register_user(db=db, payload=payload, ip_address=get_client_ip(request)),
    )


@app.post("/auth/login", response_model=AuthFlowResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)) -> dict[str, object]:
    data = authenticate_user(db=db, payload=payload, ip_address=get_client_ip(request))
    if data.get("email_verification_required"):
        return {"success": False, "message": "Email verification required.", "data": data}
    if data.get("two_factor_setup_required"):
        return success_response("Authenticator setup required.", data)
    return success_response("Two-factor authentication required.", data)


@app.post("/auth/verify-email", response_model=AuthFlowResponse)
def verify_email(payload: VerifyCodeRequest, request: Request, db: Session = Depends(get_db)) -> dict[str, object]:
    return success_response(
        "Email verified successfully.",
        verify_email_code(db=db, payload=payload, ip_address=get_client_ip(request)),
    )


@app.post("/auth/resend-verification", response_model=AuthFlowResponse)
def resend_verification(payload: ResendVerificationRequest, request: Request, db: Session = Depends(get_db)) -> dict[str, object]:
    return success_response(
        "If verification is required, a new code has been sent.",
        resend_verification_code(db=db, email=str(payload.email), ip_address=get_client_ip(request)),
    )


@app.post("/auth/set-password", response_model=AuthFlowResponse)
def set_password(payload: SetPasswordRequest, request: Request, db: Session = Depends(get_db)) -> dict[str, object]:
    return success_response(
        "Password set successfully. You can now log in.",
        set_password_with_code(db=db, payload=payload, ip_address=get_client_ip(request)),
    )


@app.post("/auth/password/forgot", response_model=MessageResponse)
def forgot_password(payload: ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)) -> dict[str, object]:
    request_password_reset(db=db, payload=payload, ip_address=get_client_ip(request))
    return success_response("If this email exists, a password reset code has been sent.", {})


@app.post("/auth/password/reset", response_model=MessageResponse)
def reset_password(payload: ResetPasswordRequest, request: Request, db: Session = Depends(get_db)) -> dict[str, object]:
    reset_password_with_code(db=db, payload=payload, ip_address=get_client_ip(request))
    return success_response("Password reset successfully. Please log in again.", {})


@app.post("/auth/2fa/verify")
def verify_2fa(payload: VerifyCodeRequest, request: Request, db: Session = Depends(get_db)) -> dict[str, object]:
    token_response = verify_login_2fa(db=db, payload=payload, ip_address=get_client_ip(request))
    return success_response("Login successful.", token_response.model_dump(mode="json"))


@app.post("/auth/2fa/setup/verify")
def verify_2fa_setup(payload: VerifyTotpSetupRequest, request: Request, db: Session = Depends(get_db)) -> dict[str, object]:
    token_response = verify_totp_setup(db=db, payload=payload, ip_address=get_client_ip(request))
    return success_response("Authenticator setup complete.", token_response.model_dump(mode="json"))


@app.post("/auth/logout")
def logout(
    context: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    logout_user(db=db, context=context)
    return success_response("Logged out successfully.")


@app.get("/auth/me", response_model=UserResponse)
def me(current_user=Depends(get_current_user), db: Session = Depends(get_db)) -> UserResponse:
    return user_response(db, current_user)


@app.patch("/auth/profile", response_model=UserActionResponse)
def update_profile(
    payload: ProfileUpdateRequest,
    request: Request,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    user = update_own_profile(
        db=db,
        user=current_user,
        payload=payload,
        ip_address=get_client_ip(request),
    )
    return success_response("Profile updated successfully.", user_response(db, user))


@app.patch("/auth/password", response_model=MessageResponse)
def change_password(
    payload: PasswordChangeRequest,
    request: Request,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    change_own_password(
        db=db,
        user=current_user,
        payload=payload,
        ip_address=get_client_ip(request),
    )
    return success_response("Password updated successfully.", {})


@app.get("/auth/users", response_model=UsersListResponse)
def users(
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    safe_users = [user_response(db, user) for user in list_users(db)]
    return success_response("Users retrieved successfully.", safe_users)


@app.post("/auth/users", response_model=UserActionResponse, status_code=201)
def create_user(
    payload: AdminCreateUserRequest,
    request: Request,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    user = create_user_by_admin(db=db, payload=payload, admin_id=current_user.id, ip_address=get_client_ip(request))
    return success_response("User created successfully. Account setup code sent by email.", user_response(db, user))


@app.delete("/auth/users/{user_id}", response_model=UserActionResponse)
def delete_user(
    user_id: int,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own account.",
        )

    deleted_user = delete_user_by_admin(db=db, user_id=user_id)
    return success_response("User deleted successfully.", deleted_user)


@app.get("/auth/admin-only")
def admin_only(current_user=Depends(require_admin)) -> dict[str, object]:
    return success_response(
        "Admin access granted.",
        {"user_id": current_user.id, "role": current_user.role},
    )


@app.get("/auth/oauth/github/login")
def github_oauth_login(request: Request, db: Session = Depends(get_db)) -> RedirectResponse:
    if not oauth_configured():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="GitHub OAuth is not configured.")

    state = create_github_oauth_state(db=db, ip_address=get_client_ip(request))
    query = urlencode({
        "client_id": settings.github_client_id,
        "redirect_uri": settings.github_oauth_redirect_uri,
        "scope": "user:email",
        "state": state,
    })
    return RedirectResponse(f"https://github.com/login/oauth/authorize?{query}", status_code=status.HTTP_307_TEMPORARY_REDIRECT)


@app.get("/auth/oauth/github/callback")
def github_oauth_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    db: Session = Depends(get_db),
) -> RedirectResponse:
    if not code:
        return RedirectResponse(github_callback_redirect(error="github_login_failed"), status_code=status.HTTP_307_TEMPORARY_REDIRECT)

    try:
        token_response = complete_github_oauth_login(
            db=db,
            code=code,
            state=state,
            ip_address=get_client_ip(request),
        )
    except HTTPException:
        return RedirectResponse(github_callback_redirect(error="github_login_failed"), status_code=status.HTTP_307_TEMPORARY_REDIRECT)

    return RedirectResponse(
        github_callback_redirect(token=token_response.access_token, role=token_response.user.role),
        status_code=status.HTTP_307_TEMPORARY_REDIRECT,
    )
