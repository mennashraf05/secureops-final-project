from fastapi import Depends, FastAPI, HTTPException
from sqlalchemy.orm import Session

from dependencies import AuthContext, get_current_auth_context, get_current_user, require_admin
from schemas import LoginRequest, RegisterRequest, TokenResponse, UserResponse
from seed import seed_default_users
from service import authenticate_user, logout_user, register_user
from shared.database import Base, SessionLocal, engine, get_db
from shared.errors import safe_exception_handler, safe_http_exception_handler
from shared.responses import success_response


SERVICE_NAME = "auth-service"

app = FastAPI(title="SecureOps Auth Service")
app.add_exception_handler(Exception, safe_exception_handler)
app.add_exception_handler(HTTPException, safe_http_exception_handler)


def health_response() -> dict[str, str]:
    return {"service": SERVICE_NAME, "status": "healthy"}


@app.on_event("startup")
def startup() -> None:
    Base.metadata.create_all(bind=engine)
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


@app.post("/auth/register", response_model=UserResponse, status_code=201)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> UserResponse:
    return register_user(db=db, payload=payload)


@app.post("/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    return authenticate_user(db=db, payload=payload)


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
