from datetime import datetime, timedelta, timezone
import os
import secrets
from typing import TYPE_CHECKING

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from email_service import send_email
from models import ALLOWED_ROLES, AuthCode, RevokedToken, User
from schemas import AdminCreateUserRequest, LoginRequest, RegisterRequest, SetPasswordRequest, TokenResponse, UserResponse, VerifyCodeRequest, VerifyTotpSetupRequest
from security import create_access_token, generate_totp_secret, hash_code, hash_password, totp_uri, verify_code, verify_password, verify_totp
from shared.audit_client import send_audit_event

if TYPE_CHECKING:
    from dependencies import AuthContext


EMAIL_VERIFICATION_MINUTES = 10
LOGIN_2FA_MINUTES = 5
MAX_CODE_ATTEMPTS = 5
PURPOSE_EMAIL_VERIFICATION = "email_verification"


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
    send_audit_event(
        "admin.action",
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

    safe_user = UserResponse.model_validate(user)
    db.query(AuthCode).filter(AuthCode.user_id == user_id).delete(synchronize_session=False)
    db.delete(user)
    db.commit()
    send_audit_event(
        "admin.action",
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
    expires_in = EMAIL_VERIFICATION_MINUTES if purpose == PURPOSE_EMAIL_VERIFICATION else LOGIN_2FA_MINUTES
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

    token, _, _, expires_in = create_access_token(user)
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
    return TokenResponse(access_token=token, expires_in=expires_in, user=UserResponse.model_validate(user))


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

    token, _, _, expires_in = create_access_token(user)
    send_audit_event("auth.2fa.success", "auth-service", "success", user_id=user.id, ip_address=ip_address, details={"email": user.email, "role": user.role, "setup": True})
    send_audit_event("auth.login.success", "auth-service", "success", user_id=user.id, ip_address=ip_address, details={"email": user.email, "role": user.role})
    return TokenResponse(access_token=token, expires_in=expires_in, user=UserResponse.model_validate(user))


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
