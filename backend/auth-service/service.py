from datetime import datetime, timedelta, timezone
import hashlib
import os
import requests
import secrets
from typing import TYPE_CHECKING

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from email_service import send_email
from models import ALLOWED_ROLES, AuthCode, OAuthState, Permission, RevokedToken, Role, RolePermission, User, UserRole
from schemas import AdminCreateUserRequest, ForgotPasswordRequest, LoginRequest, PasswordChangeRequest, ProfileUpdateRequest, RegisterRequest, ResetPasswordRequest, SetPasswordRequest, TokenResponse, UserResponse, VerifyCodeRequest, VerifyTotpSetupRequest
from security import create_access_token, generate_totp_secret, hash_code, hash_password, totp_uri, verify_code, verify_password, verify_totp
from shared.audit_client import send_audit_event
from shared.config import settings

if TYPE_CHECKING:
    from dependencies import AuthContext


EMAIL_VERIFICATION_MINUTES = 10
LOGIN_2FA_MINUTES = 5
MAX_CODE_ATTEMPTS = 5
PURPOSE_EMAIL_VERIFICATION = "email_verification"
PURPOSE_PASSWORD_RESET = "password_reset"
OAUTH_STATE_MINUTES = 10
GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_USER_URL = "https://api.github.com/user"
GITHUB_EMAILS_URL = "https://api.github.com/user/emails"

ADMIN_PERMISSIONS = {
    "users:read",
    "users:create",
    "users:delete",
    "products:read",
    "products:write",
    "orders:read",
    "orders:approve",
    "reports:read",
    "reports:create",
    "audit:read",
    "security:read",
    "settings:read",
}
USER_PERMISSIONS = {
    "products:read",
    "orders:create",
    "orders:read_own",
    "profile:read",
    "profile:update",
}


def normalize_email(email: str) -> str:
    return email.strip().lower()


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def aware_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == normalize_email(email)).first()


def get_user_by_id(db: Session, user_id: int) -> User | None:
    return db.query(User).filter(User.id == user_id).first()


def list_users(db: Session) -> list[User]:
    return db.query(User).order_by(User.id.asc()).all()


def get_role_by_name(db: Session, role_name: str) -> Role | None:
    return db.query(Role).filter(Role.name == role_name.strip().lower()).first()


def get_or_create_role(db: Session, name: str, description: str | None = None) -> Role:
    normalized = name.strip().lower()
    role = get_role_by_name(db, normalized)
    if role:
        if description and role.description != description:
            role.description = description
        return role
    role = Role(name=normalized, description=description)
    db.add(role)
    db.flush()
    return role


def get_or_create_permission(db: Session, name: str, description: str | None = None) -> Permission:
    normalized = name.strip().lower()
    permission = db.query(Permission).filter(Permission.name == normalized).first()
    if permission:
        if description and permission.description != description:
            permission.description = description
        return permission
    permission = Permission(name=normalized, description=description)
    db.add(permission)
    db.flush()
    return permission


def grant_permission_to_role(db: Session, role: Role, permission: Permission) -> None:
    exists = db.query(RolePermission).filter(
        RolePermission.role_id == role.id,
        RolePermission.permission_id == permission.id,
    ).first()
    if exists:
        return
    db.add(RolePermission(role_id=role.id, permission_id=permission.id))
    db.flush()


def seed_rbac(db: Session) -> None:
    admin_role = get_or_create_role(db, "admin", "Full administrative access.")
    user_role = get_or_create_role(db, "user", "Standard user access.")

    permissions: dict[str, Permission] = {}
    for permission_name in sorted(ADMIN_PERMISSIONS | USER_PERMISSIONS):
        permissions[permission_name] = get_or_create_permission(db, permission_name)

    for permission_name in sorted(ADMIN_PERMISSIONS | USER_PERMISSIONS):
        grant_permission_to_role(db, admin_role, permissions[permission_name])
    for permission_name in sorted(USER_PERMISSIONS):
        grant_permission_to_role(db, user_role, permissions[permission_name])
    db.commit()


def user_role_names(user: User) -> list[str]:
    names = sorted({
        user_role.role.name
        for user_role in (user.user_roles or [])
        if user_role.role and user_role.role.name in ALLOWED_ROLES
    })
    if names:
        return names
    return [user.role if user.role in ALLOWED_ROLES else "user"]


def effective_user_role(user: User) -> str:
    names = user_role_names(user)
    if "admin" in names:
        return "admin"
    return "user"


def user_has_role(user: User, role_name: str) -> bool:
    return role_name.strip().lower() in user_role_names(user)


def user_has_permission(db: Session, user: User, permission_name: str) -> bool:
    normalized = permission_name.strip().lower()
    role_names = user_role_names(user)
    return db.query(RolePermission).join(Role).join(Permission).filter(
        Role.name.in_(role_names),
        Permission.name == normalized,
    ).first() is not None


def assign_role_to_user(db: Session, user: User, role_name: str, *, replace: bool = True) -> None:
    normalized = role_name.strip().lower()
    if normalized not in ALLOWED_ROLES:
        normalized = "user"

    role = get_or_create_role(db, normalized)
    if replace:
        db.query(UserRole).filter(UserRole.user_id == user.id).delete(synchronize_session=False)

    exists = db.query(UserRole).filter(
        UserRole.user_id == user.id,
        UserRole.role_id == role.id,
    ).first()
    if not exists:
        db.add(UserRole(user_id=user.id, role_id=role.id))
    user.role = normalized


def backfill_user_roles(db: Session) -> None:
    seed_rbac(db)
    users = db.query(User).order_by(User.id.asc()).all()
    for user in users:
        assign_role_to_user(db, user, user.role if user.role in ALLOWED_ROLES else "user", replace=False)
    db.commit()


def permissions_count_for_user(db: Session, user: User) -> int:
    role_names = user_role_names(user)
    return int(db.query(Permission.name).join(RolePermission).join(Role).filter(
        Role.name.in_(role_names),
    ).distinct().count())


def user_response(db: Session, user: User) -> UserResponse:
    response = UserResponse.model_validate(user)
    response.role = effective_user_role(user)
    response.roles = user_role_names(user)
    response.permissions_count = permissions_count_for_user(db, user)
    return response


def update_own_profile(db: Session, *, user: User, payload: ProfileUpdateRequest, ip_address: str | None = None) -> User:
    user.name = payload.name.strip()
    db.add(user)
    db.commit()
    db.refresh(user)
    send_audit_event(
        "auth.profile.updated",
        "auth-service",
        "success",
        user_id=user.id,
        ip_address=ip_address,
        details={"email": user.email},
    )
    return user


def change_own_password(db: Session, *, user: User, payload: PasswordChangeRequest, ip_address: str | None = None) -> None:
    if not verify_password(payload.current_password, user.password_hash):
        send_audit_event(
            "auth.password_change.failed",
            "auth-service",
            "failure",
            user_id=user.id,
            ip_address=ip_address,
            details={"email": user.email, "reason": "invalid_current_password"},
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect.")

    validate_password_strength(payload.new_password)
    user.password_hash = hash_password(payload.new_password)
    db.add(user)
    db.commit()
    send_audit_event(
        "auth.password_changed",
        "auth-service",
        "success",
        user_id=user.id,
        ip_address=ip_address,
        details={"email": user.email},
    )


def validate_password_strength(password: str) -> None:
    has_lower = any(char.islower() for char in password)
    has_upper = any(char.isupper() for char in password)
    has_number_or_symbol = any(not char.isalpha() for char in password)
    if len(password) < 8 or not has_lower or not has_upper or not has_number_or_symbol:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters and include uppercase, lowercase, and a number or symbol.",
        )


def temporary_password_hash() -> str:
    return hash_password(secrets.token_urlsafe(32))


def oauth_configured() -> bool:
    return bool(settings.github_client_id and settings.github_client_secret and settings.github_oauth_redirect_uri)


def oauth_state_hash(state: str) -> str:
    return hashlib.sha256(state.encode("utf-8")).hexdigest()


def create_github_oauth_state(db: Session, ip_address: str | None = None) -> str:
    state = secrets.token_urlsafe(32)
    db.query(OAuthState).filter(OAuthState.expires_at < utc_now()).delete(synchronize_session=False)
    db.add(
        OAuthState(
            provider="github",
            state_hash=oauth_state_hash(state),
            expires_at=utc_now() + timedelta(minutes=OAUTH_STATE_MINUTES),
        )
    )
    db.commit()
    send_audit_event(
        "auth.oauth.github.started",
        "auth-service",
        "info",
        ip_address=ip_address,
        details={"provider": "github"},
    )
    return state


def validate_github_oauth_state(db: Session, state: str | None, ip_address: str | None = None) -> None:
    if not state:
        send_audit_event(
            "auth.oauth.github.failed",
            "auth-service",
            "blocked",
            ip_address=ip_address,
            details={"reason": "missing_state"},
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid GitHub OAuth state.")

    row = (
        db.query(OAuthState)
        .filter(
            OAuthState.provider == "github",
            OAuthState.state_hash == oauth_state_hash(state),
            OAuthState.used_at.is_(None),
        )
        .first()
    )
    if not row or aware_utc(row.expires_at) < utc_now():
        send_audit_event(
            "auth.oauth.github.failed",
            "auth-service",
            "blocked",
            ip_address=ip_address,
            details={"reason": "invalid_state"},
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid GitHub OAuth state.")

    row.used_at = utc_now()
    db.commit()


def frontend_url() -> str:
    return settings.frontend_url.rstrip("/")


def github_callback_redirect(token: str | None = None, role: str | None = None, error: str | None = None) -> str:
    if error:
        return f"{frontend_url()}/oauth/callback?error={error}"
    return f"{frontend_url()}/oauth/callback?token={token}&role={role}"


def exchange_github_code(code: str) -> str:
    response = requests.post(
        GITHUB_TOKEN_URL,
        headers={"Accept": "application/json"},
        data={
            "client_id": settings.github_client_id,
            "client_secret": settings.github_client_secret,
            "code": code,
            "redirect_uri": settings.github_oauth_redirect_uri,
        },
        timeout=10,
    )
    response.raise_for_status()
    payload = response.json()
    access_token = payload.get("access_token")
    if not access_token:
        raise ValueError("GitHub token exchange failed.")
    return str(access_token)


def fetch_github_json(url: str, access_token: str):
    response = requests.get(
        url,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {access_token}",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        timeout=10,
    )
    response.raise_for_status()
    return response.json()


def verified_github_email(profile: dict, emails: list[dict]) -> str | None:
    for email in emails:
        if email.get("primary") and email.get("verified") and email.get("email"):
            return normalize_email(str(email["email"]))

    public_email = profile.get("email")
    if public_email:
        return normalize_email(str(public_email))

    for email in emails:
        if email.get("verified") and email.get("email"):
            return normalize_email(str(email["email"]))

    return None


def find_or_create_github_user(db: Session, *, email: str, profile: dict, ip_address: str | None = None) -> tuple[User, bool]:
    user = get_user_by_email(db, email)
    github_id = str(profile.get("id") or "")
    github_name = str(profile.get("name") or profile.get("login") or email)

    if user:
        user.email_verified = True
        user.oauth_provider = "github"
        user.oauth_id = github_id or user.oauth_id
        assign_role_to_user(db, user, user.role if user.role in ALLOWED_ROLES else "user", replace=False)
        db.commit()
        db.refresh(user)
        return user, False

    user = User(
        name=github_name,
        email=email,
        password_hash=temporary_password_hash(),
        role="user",
        oauth_provider="github",
        oauth_id=github_id or None,
        email_verified=True,
        two_factor_enabled=True,
        two_factor_required=True,
        two_factor_method="authenticator",
        totp_confirmed=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    assign_role_to_user(db, user, "user")
    db.commit()
    db.refresh(user)
    send_audit_event(
        "auth.oauth.github.user.created",
        "auth-service",
        "success",
        user_id=user.id,
        ip_address=ip_address,
        details={"email": user.email, "role": user.role},
    )
    return user, True


def complete_github_oauth_login(db: Session, *, code: str, state: str | None, ip_address: str | None = None) -> TokenResponse:
    if not oauth_configured():
        send_audit_event(
            "auth.oauth.github.failed",
            "auth-service",
            "failure",
            ip_address=ip_address,
            details={"reason": "not_configured"},
        )
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="GitHub OAuth is not configured.")

    validate_github_oauth_state(db, state, ip_address=ip_address)

    try:
        access_token = exchange_github_code(code)
        profile = fetch_github_json(GITHUB_USER_URL, access_token)
        emails_payload = fetch_github_json(GITHUB_EMAILS_URL, access_token)
        emails = emails_payload if isinstance(emails_payload, list) else []
        email = verified_github_email(profile if isinstance(profile, dict) else {}, emails)
        if not email:
            raise ValueError("verified_email_missing")
        user, _ = find_or_create_github_user(db, email=email, profile=profile, ip_address=ip_address)
    except HTTPException:
        raise
    except Exception as exc:
        send_audit_event(
            "auth.oauth.github.failed",
            "auth-service",
            "failure",
            ip_address=ip_address,
            details={"reason": exc.__class__.__name__},
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="GitHub account does not provide a verified email." if str(exc) == "verified_email_missing" else "GitHub login failed.",
        ) from exc

    if not user.is_active:
        send_audit_event(
            "auth.oauth.github.failed",
            "auth-service",
            "blocked",
            user_id=user.id,
            ip_address=ip_address,
            details={"reason": "inactive_user"},
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="GitHub login failed.")

    token, _, _, expires_in = create_access_token(user)
    send_audit_event(
        "auth.oauth.github.success",
        "auth-service",
        "success",
        user_id=user.id,
        ip_address=ip_address,
        details={"email": user.email, "role": user.role},
    )
    send_audit_event(
        "auth.login.success",
        "auth-service",
        "success",
        user_id=user.id,
        ip_address=ip_address,
        details={"email": user.email, "role": user.role, "provider": "github"},
    )
    return TokenResponse(access_token=token, expires_in=expires_in, user=user_response(db, user))


def app_base_url() -> str:
    return os.getenv("APP_BASE_URL", "http://localhost:8080").rstrip("/")


def create_user_by_admin(db: Session, payload: AdminCreateUserRequest, admin_id: int | None = None, ip_address: str | None = None) -> User:
    email = normalize_email(payload.email)
    if get_user_by_email(db, email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered.",
        )

    user = User(
        name=payload.name.strip(),
        email=email,
        password_hash=temporary_password_hash(),
        role=payload.role,
        email_verified=False,
        two_factor_enabled=True,
        two_factor_required=True,
        two_factor_method="authenticator",
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered.",
        ) from exc

    db.refresh(user)
    assign_role_to_user(db, user, payload.role)
    db.commit()
    db.refresh(user)
    send_audit_event(
        "auth.admin.user.created",
        "auth-service",
        "success",
        user_id=admin_id,
        ip_address=ip_address,
        details={"target_user_id": user.id, "email": user.email, "role": user.role, "operation": "created_user"},
    )
    send_account_setup_code(db, user, ip_address=ip_address)
    return user


def delete_user_by_admin(db: Session, user_id: int) -> UserResponse:
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    safe_user = user_response(db, user)
    db.query(AuthCode).filter(AuthCode.user_id == user_id).delete(synchronize_session=False)
    db.query(UserRole).filter(UserRole.user_id == user_id).delete(synchronize_session=False)
    db.delete(user)
    db.commit()
    send_audit_event(
        "auth.admin.user.deleted",
        "auth-service",
        "success",
        user_id=safe_user.id,
        details={"target_user_id": safe_user.id, "email": safe_user.email, "role": safe_user.role, "operation": "deleted_user"},
    )
    return safe_user


def is_token_revoked(db: Session, token_jti: str) -> bool:
    return db.query(RevokedToken).filter(RevokedToken.token_jti == token_jti).first() is not None


def generate_numeric_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def create_auth_code(db: Session, user: User, purpose: str, code: str) -> AuthCode:
    expires_in = EMAIL_VERIFICATION_MINUTES if purpose in {PURPOSE_EMAIL_VERIFICATION, PURPOSE_PASSWORD_RESET} else LOGIN_2FA_MINUTES
    auth_code = AuthCode(
        user_id=user.id,
        code_hash=hash_code(code),
        purpose=purpose,
        expires_at=utc_now() + timedelta(minutes=expires_in),
    )
    db.add(auth_code)
    db.commit()
    db.refresh(auth_code)
    return auth_code


def send_verification_code(db: Session, user: User, ip_address: str | None = None, resent: bool = False) -> None:
    code = generate_numeric_code()
    create_auth_code(db, user, PURPOSE_EMAIL_VERIFICATION, code)
    try:
        send_email(
            user.email,
            "SecureOps email verification code",
            f"Your SecureOps email verification code is {code}. It expires in {EMAIL_VERIFICATION_MINUTES} minutes.",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not send verification email. Check SMTP configuration.",
        ) from exc
    send_audit_event(
        "auth.email_verification.resent" if resent else "auth.email_verification.sent",
        "auth-service",
        "success",
        user_id=user.id,
        ip_address=ip_address,
        details={"email": user.email},
    )


def send_account_setup_code(db: Session, user: User, ip_address: str | None = None) -> None:
    code = generate_numeric_code()
    create_auth_code(db, user, PURPOSE_EMAIL_VERIFICATION, code)
    setup_link = f"{app_base_url()}/setup-account?email={user.email}&code={code}"
    try:
        send_email(
            user.email,
            "SecureOps account setup link",
            (
                f"Open this SecureOps setup link to set your password:\n{setup_link}\n\n"
                f"The setup code is {code} and expires in {EMAIL_VERIFICATION_MINUTES} minutes.\n\n"
                "Your password must be at least 8 characters and include uppercase, lowercase, and a number or symbol. "
                "After setting your password, connect an authenticator app such as Google Authenticator."
            ),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not send account setup email. Check SMTP configuration.",
        ) from exc
    send_audit_event(
        "auth.email_verification.sent",
        "auth-service",
        "success",
        user_id=user.id,
        ip_address=ip_address,
        details={"email": user.email, "account_setup": True},
    )


def request_password_reset(db: Session, payload: ForgotPasswordRequest, ip_address: str | None = None) -> dict[str, str]:
    email = normalize_email(str(payload.email))
    user = get_user_by_email(db, email)
    if not user:
        send_audit_event(
            "auth.password_reset.requested_unknown",
            "auth-service",
            "info",
            ip_address=ip_address,
            details={"email": email},
        )
        return {"email": email}

    code = generate_numeric_code()
    create_auth_code(db, user, PURPOSE_PASSWORD_RESET, code)
    try:
        send_email(
            user.email,
            "SecureOps Password Reset Code",
            (
                f"Your password reset code is: {code}\n"
                "This code expires in 10 minutes.\n"
                "If you did not request this, ignore this email."
            ),
        )
    except Exception as exc:
        send_audit_event(
            "auth.password_reset.failed",
            "auth-service",
            "failure",
            user_id=user.id,
            ip_address=ip_address,
            details={"email": user.email, "reason": "email_send_failed"},
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not send password reset email. Check SMTP configuration.",
        ) from exc

    send_audit_event(
        "auth.password_reset.requested",
        "auth-service",
        "success",
        user_id=user.id,
        ip_address=ip_address,
        details={"email": user.email},
    )
    return {"email": email}


def reset_password_with_code(db: Session, payload: ResetPasswordRequest, ip_address: str | None = None) -> dict[str, str]:
    validate_password_strength(payload.new_password)
    email = normalize_email(str(payload.email))
    user = get_user_by_email(db, email)
    if not user:
        send_audit_event(
            "auth.password_reset.failed",
            "auth-service",
            "failure",
            ip_address=ip_address,
            details={"email": email, "reason": "invalid_user_or_code"},
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset code.")

    try:
        auth_code = validate_auth_code(db, user, PURPOSE_PASSWORD_RESET, payload.code)
    except HTTPException:
        send_audit_event(
            "auth.password_reset.failed",
            "auth-service",
            "failure",
            user_id=user.id,
            ip_address=ip_address,
            details={"email": user.email, "reason": "invalid_or_expired_code"},
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset code.") from None

    user.password_hash = hash_password(payload.new_password)
    auth_code.used_at = utc_now()
    db.add(user)
    db.add(auth_code)
    db.commit()
    send_audit_event(
        "auth.password_reset.success",
        "auth-service",
        "success",
        user_id=user.id,
        ip_address=ip_address,
        details={"email": user.email},
    )
    return {"email": user.email}


def latest_unused_code(db: Session, user: User, purpose: str) -> AuthCode | None:
    return (
        db.query(AuthCode)
        .filter(
            AuthCode.user_id == user.id,
            AuthCode.purpose == purpose,
            AuthCode.used_at.is_(None),
        )
        .order_by(AuthCode.created_at.desc(), AuthCode.id.desc())
        .first()
    )


def validate_auth_code(db: Session, user: User, purpose: str, code: str) -> AuthCode:
    auth_code = latest_unused_code(db, user, purpose)
    now = utc_now()
    if not auth_code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired code.")

    if auth_code.attempts >= MAX_CODE_ATTEMPTS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Maximum code attempts exceeded.")

    if aware_utc(auth_code.expires_at) < now:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Code has expired.")

    if not verify_code(code, auth_code.code_hash):
        auth_code.attempts += 1
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired code.")

    auth_code.used_at = now
    db.commit()
    db.refresh(auth_code)
    return auth_code


def register_user(db: Session, payload: RegisterRequest, ip_address: str | None = None) -> dict[str, object]:
    validate_password_strength(payload.password)
    email = normalize_email(payload.email)
    if get_user_by_email(db, email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered.",
        )

    user = User(
        name=payload.name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
        role="user",
        email_verified=False,
        two_factor_enabled=True,
        two_factor_required=True,
        two_factor_method="authenticator",
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered.",
        ) from exc

    db.refresh(user)
    assign_role_to_user(db, user, "user")
    db.commit()
    db.refresh(user)
    send_audit_event(
        "auth.register.success",
        "auth-service",
        "success",
        user_id=user.id,
        ip_address=ip_address,
        details={"email": user.email, "role": user.role},
    )
    send_verification_code(db, user, ip_address=ip_address)
    return {"email": user.email, "email_verification_required": True}


def create_user_if_missing(
    db: Session,
    *,
    name: str,
    email: str,
    password: str,
    role: str,
) -> User:
    if role not in ALLOWED_ROLES:
        raise ValueError("Unsupported role.")

    existing_user = get_user_by_email(db, email)
    if existing_user:
        existing_user.email_verified = True
        existing_user.two_factor_enabled = True
        existing_user.two_factor_required = True
        existing_user.two_factor_method = "authenticator"
        assign_role_to_user(db, existing_user, existing_user.role if existing_user.role in ALLOWED_ROLES else role, replace=False)
        db.commit()
        db.refresh(existing_user)
        return existing_user

    user = User(
        name=name,
        email=normalize_email(email),
        password_hash=hash_password(password),
        role=role,
        email_verified=True,
        two_factor_enabled=True,
        two_factor_required=True,
        two_factor_method="authenticator",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    assign_role_to_user(db, user, role)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, payload: LoginRequest, ip_address: str | None = None) -> dict[str, object]:
    email = normalize_email(payload.email)
    user = get_user_by_email(db, email)
    if not user or not verify_password(payload.password, user.password_hash):
        send_audit_event(
            "auth.login.failed",
            "auth-service",
            "failure",
            ip_address=ip_address,
            details={"email": email},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        send_audit_event(
            "auth.login.failed",
            "auth-service",
            "failure",
            user_id=user.id,
            ip_address=ip_address,
            details={"email": email, "reason": "inactive_user"},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.email_verified:
        return {
            "email_verification_required": True,
            "email": user.email,
        }

    if not user.totp_secret or not user.totp_confirmed:
        user.totp_secret = generate_totp_secret()
        user.totp_confirmed = False
        user.two_factor_method = "authenticator"
        db.commit()
        send_audit_event(
            "auth.2fa.setup_required",
            "auth-service",
            "success",
            user_id=user.id,
            ip_address=ip_address,
            details={"email": user.email, "role": user.role},
        )
        return {
            "two_factor_setup_required": True,
            "email": user.email,
            "totp_secret": user.totp_secret,
            "otpauth_uri": totp_uri(user.totp_secret, user.email),
        }

    send_audit_event(
        "auth.login.2fa_required",
        "auth-service",
        "success",
        user_id=user.id,
        ip_address=ip_address,
        details={"email": user.email, "role": user.role, "method": "authenticator"},
    )
    return {"two_factor_required": True, "email": user.email}


def verify_email_code(db: Session, payload: VerifyCodeRequest, ip_address: str | None = None) -> dict[str, str]:
    email = normalize_email(payload.email)
    user = get_user_by_email(db, email)
    if not user:
        send_audit_event("auth.email_verification.failed", "auth-service", "failure", ip_address=ip_address, details={"email": email})
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired code.")

    if user.email_verified:
        return {"email": user.email}

    try:
        validate_auth_code(db, user, PURPOSE_EMAIL_VERIFICATION, payload.code)
    except HTTPException:
        send_audit_event(
            "auth.email_verification.failed",
            "auth-service",
            "failure",
            user_id=user.id,
            ip_address=ip_address,
            details={"email": user.email},
        )
        raise

    user.email_verified = True
    db.commit()
    send_audit_event(
        "auth.email_verified",
        "auth-service",
        "success",
        user_id=user.id,
        ip_address=ip_address,
        details={"email": user.email},
    )
    return {"email": user.email}


def set_password_with_code(db: Session, payload: SetPasswordRequest, ip_address: str | None = None) -> dict[str, str]:
    validate_password_strength(payload.password)
    email = normalize_email(payload.email)
    user = get_user_by_email(db, email)
    if not user:
        send_audit_event("auth.email_verification.failed", "auth-service", "failure", ip_address=ip_address, details={"email": email, "account_setup": True})
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired code.")

    try:
        validate_auth_code(db, user, PURPOSE_EMAIL_VERIFICATION, payload.code)
    except HTTPException:
        send_audit_event(
            "auth.email_verification.failed",
            "auth-service",
            "failure",
            user_id=user.id,
            ip_address=ip_address,
            details={"email": user.email, "account_setup": True},
        )
        raise

    user.password_hash = hash_password(payload.password)
    user.email_verified = True
    user.two_factor_enabled = True
    user.two_factor_required = True
    user.two_factor_method = "authenticator"
    user.totp_secret = generate_totp_secret()
    user.totp_confirmed = False
    db.commit()
    send_audit_event(
        "auth.email_verified",
        "auth-service",
        "success",
        user_id=user.id,
        ip_address=ip_address,
        details={"email": user.email, "account_setup": True},
    )
    return {"email": user.email, "two_factor_setup_required": True, "totp_secret": user.totp_secret, "otpauth_uri": totp_uri(user.totp_secret, user.email)}


def resend_verification_code(db: Session, email: str, ip_address: str | None = None) -> dict[str, object]:
    normalized_email = normalize_email(email)
    user = get_user_by_email(db, normalized_email)
    if user and not user.email_verified:
        send_verification_code(db, user, ip_address=ip_address, resent=True)
    return {"email": normalized_email, "email_verification_required": bool(user and not user.email_verified)}


def verify_login_2fa(db: Session, payload: VerifyCodeRequest, ip_address: str | None = None) -> TokenResponse:
    email = normalize_email(payload.email)
    user = get_user_by_email(db, email)
    if not user or not user.is_active or not user.email_verified:
        send_audit_event("auth.2fa.failed", "auth-service", "failure", ip_address=ip_address, details={"email": email})
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired code.")

    if not user.totp_secret or not user.totp_confirmed or not verify_totp(user.totp_secret, payload.code):
        send_audit_event(
            "auth.2fa.failed",
            "auth-service",
            "failure",
            user_id=user.id,
            ip_address=ip_address,
            details={"email": user.email},
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid authenticator code.")

    token, _, _, expires_in = create_access_token(user, remember_me=payload.remember_me)
    send_audit_event(
        "auth.2fa.success",
        "auth-service",
        "success",
        user_id=user.id,
        ip_address=ip_address,
        details={"email": user.email, "role": user.role},
    )
    send_audit_event(
        "auth.login.success",
        "auth-service",
        "success",
        user_id=user.id,
        ip_address=ip_address,
        details={"email": user.email, "role": user.role},
    )
    return TokenResponse(access_token=token, expires_in=expires_in, user=user_response(db, user))


def verify_totp_setup(db: Session, payload: VerifyTotpSetupRequest, ip_address: str | None = None) -> TokenResponse:
    email = normalize_email(payload.email)
    user = get_user_by_email(db, email)
    if not user or not user.is_active or not user.email_verified or not user.totp_secret:
        send_audit_event("auth.2fa.failed", "auth-service", "failure", ip_address=ip_address, details={"email": email, "setup": True})
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid authenticator code.")
    if not verify_totp(user.totp_secret, payload.code):
        send_audit_event("auth.2fa.failed", "auth-service", "failure", user_id=user.id, ip_address=ip_address, details={"email": user.email, "setup": True})
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid authenticator code.")

    user.totp_confirmed = True
    user.two_factor_enabled = True
    user.two_factor_required = True
    user.two_factor_method = "authenticator"
    db.commit()

    token, _, _, expires_in = create_access_token(user, remember_me=payload.remember_me)
    send_audit_event("auth.2fa.success", "auth-service", "success", user_id=user.id, ip_address=ip_address, details={"email": user.email, "role": user.role, "setup": True})
    send_audit_event("auth.login.success", "auth-service", "success", user_id=user.id, ip_address=ip_address, details={"email": user.email, "role": user.role})
    return TokenResponse(access_token=token, expires_in=expires_in, user=user_response(db, user))


def logout_user(db: Session, context: "AuthContext") -> None:
    if is_token_revoked(db, context.token_jti):
        return

    revoked_token = RevokedToken(
        token_jti=context.token_jti,
        user_id=context.user.id,
        expires_at=context.expires_at,
    )
    db.add(revoked_token)
    db.commit()
    send_audit_event(
        "auth.logout",
        "auth-service",
        "success",
        user_id=context.user.id,
        ip_address=context.ip_address,
        details={"email": context.user.email},
    )


def parse_token_expiration(exp: int | float | datetime) -> datetime:
    if isinstance(exp, datetime):
        expires_at = exp
    else:
        expires_at = datetime.fromtimestamp(exp, tz=timezone.utc)

    if expires_at.tzinfo is None:
        return expires_at.replace(tzinfo=timezone.utc)

    return expires_at.astimezone(timezone.utc)
