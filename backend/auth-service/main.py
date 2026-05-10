from fastapi import Depends, FastAPI, HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from dependencies import AuthContext, get_current_auth_context, get_current_user, require_admin
from schemas import AdminCreateUserRequest, AuthFlowResponse, LoginRequest, RegisterRequest, ResendVerificationRequest, SetPasswordRequest, TokenResponse, UserActionResponse, UserResponse, UsersListResponse, VerifyCodeRequest, VerifyTotpSetupRequest
from seed import seed_default_users
from service import authenticate_user, create_user_by_admin, delete_user_by_admin, list_users, logout_user, register_user, resend_verification_code, set_password_with_code, verify_email_code, verify_login_2fa, verify_totp_setup
from shared.database import Base, SessionLocal, engine, get_db
from shared.errors import safe_exception_handler, safe_http_exception_handler
from shared.request_utils import get_client_ip
from shared.responses import success_response


SERVICE_NAME = "auth-service"

app = FastAPI(title="SecureOps Auth Service")
app.add_exception_handler(Exception, safe_exception_handler)
app.add_exception_handler(HTTPException, safe_http_exception_handler)


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
def me(current_user=Depends(get_current_user)) -> UserResponse:
    return current_user


@app.get("/auth/users", response_model=UsersListResponse)
def users(
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    safe_users = [UserResponse.model_validate(user) for user in list_users(db)]
    return success_response("Users retrieved successfully.", safe_users)


@app.post("/auth/users", response_model=UserActionResponse, status_code=201)
def create_user(
    payload: AdminCreateUserRequest,
    request: Request,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    user = create_user_by_admin(db=db, payload=payload, admin_id=current_user.id, ip_address=get_client_ip(request))
    return success_response("User created successfully. Account setup code sent by email.", UserResponse.model_validate(user))


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
def github_oauth_login_placeholder() -> dict[str, object]:
    return success_response(
        "GitHub OAuth login will be implemented in a later part.",
        {"provider": "github", "status": "placeholder"},
    )


@app.get("/auth/oauth/github/callback")
def github_oauth_callback_placeholder() -> dict[str, object]:
    return success_response(
        "GitHub OAuth callback will be implemented in a later part.",
        {"provider": "github", "status": "placeholder"},
    )
