import os
from datetime import datetime, timezone
from typing import TYPE_CHECKING

import requests
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models import ALLOWED_ROLES, RevokedToken, User
from schemas import LoginRequest, RegisterRequest, TokenResponse, UserResponse
from security import create_access_token, hash_password, verify_password

if TYPE_CHECKING:
    from dependencies import AuthContext


def normalize_email(email: str) -> str:
    return email.strip().lower()


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == normalize_email(email)).first()


def get_user_by_id(db: Session, user_id: int) -> User | None:
    return db.query(User).filter(User.id == user_id).first()


def is_token_revoked(db: Session, token_jti: str) -> bool:
    return db.query(RevokedToken).filter(RevokedToken.token_jti == token_jti).first() is not None


def register_user(db: Session, payload: RegisterRequest) -> User:
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
    return user


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
        return existing_user

    user = User(
        name=name,
        email=normalize_email(email),
        password_hash=hash_password(password),
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, payload: LoginRequest) -> TokenResponse:
    email = normalize_email(payload.email)
    user = get_user_by_email(db, email)
    if not user or not verify_password(payload.password, user.password_hash):
        send_audit_event("failed_login", email=email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token, _, _, expires_in = create_access_token(user)
    send_audit_event("successful_login", user_id=user.id, email=user.email)
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
    send_audit_event("logout", user_id=context.user.id, email=context.user.email)


def parse_token_expiration(exp: int | float | datetime) -> datetime:
    if isinstance(exp, datetime):
        expires_at = exp
    else:
        expires_at = datetime.fromtimestamp(exp, tz=timezone.utc)

    if expires_at.tzinfo is None:
        return expires_at.replace(tzinfo=timezone.utc)

    return expires_at.astimezone(timezone.utc)


def send_audit_event(action: str, **metadata: object) -> None:
    audit_url = os.getenv("AUDIT_SERVICE_URL", "http://audit-service:8000/audit/events")
    payload = {"source": "auth-service", "action": action, "metadata": metadata}
    try:
        requests.post(audit_url, json=payload, timeout=1.5)
    except requests.RequestException:
        return
