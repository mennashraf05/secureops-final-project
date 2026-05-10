from dataclasses import dataclass
from datetime import datetime

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from models import User
from security import decode_token
from service import get_user_by_id, is_token_revoked, parse_token_expiration
from shared.audit_client import send_audit_event
from shared.database import get_db


bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class AuthContext:
    user: User
    token: str
    token_jti: str
    expires_at: datetime
    payload: dict


def authentication_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_auth_context(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> AuthContext:
    if credentials is None or credentials.scheme.lower() != "bearer":
        send_audit_event("auth.unauthorized", "auth-service", "blocked", details={"reason": "missing_bearer_token"})
        raise authentication_error()

    token = credentials.credentials
    try:
        payload = decode_token(token)
        user_id = int(payload.get("sub", ""))
        token_jti = str(payload.get("jti", ""))
        expires_at = parse_token_expiration(payload["exp"])
    except (KeyError, TypeError, ValueError):
        send_audit_event("auth.unauthorized", "auth-service", "blocked", details={"reason": "invalid_token"})
        raise authentication_error() from None

    if not token_jti or is_token_revoked(db, token_jti):
        send_audit_event("auth.unauthorized", "auth-service", "blocked", user_id=user_id, details={"reason": "revoked_token"})
        raise authentication_error()

    user = get_user_by_id(db, user_id)
    if not user or not user.is_active:
        send_audit_event("auth.unauthorized", "auth-service", "blocked", user_id=user_id, details={"reason": "inactive_or_missing_user"})
        raise authentication_error()

    return AuthContext(
        user=user,
        token=token,
        token_jti=token_jti,
        expires_at=expires_at,
        payload=payload,
    )


def get_current_user(context: AuthContext = Depends(get_current_auth_context)) -> User:
    return context.user


def require_admin(context: AuthContext = Depends(get_current_auth_context)) -> User:
    if context.user.role != "admin":
        send_audit_event(
            "auth.admin.denied",
            "auth-service",
            "blocked",
            user_id=context.user.id,
            details={"email": context.user.email, "role": context.user.role},
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required.",
        )

    return context.user
