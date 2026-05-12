from dataclasses import dataclass
from datetime import datetime

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from models import User
from security import decode_token
from service import effective_user_role, get_user_by_id, is_token_revoked, parse_token_expiration, user_has_role
from shared.audit_client import send_audit_event
from shared.database import get_db
from shared.request_utils import get_client_ip


bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class AuthContext:
    user: User
    token: str
    token_jti: str
    expires_at: datetime
    payload: dict
    ip_address: str | None


def authentication_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_auth_context(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> AuthContext:
    ip_address = get_client_ip(request)
    if credentials is None or credentials.scheme.lower() != "bearer":
        send_audit_event("auth.unauthorized", "auth-service", "blocked", ip_address=ip_address, details={"reason": "missing_bearer_token"})
        raise authentication_error()

    token = credentials.credentials
    try:
        payload = decode_token(token)
        user_id = int(payload.get("sub", ""))
        token_jti = str(payload.get("jti", ""))
        expires_at = parse_token_expiration(payload["exp"])
    except (KeyError, TypeError, ValueError):
        send_audit_event("auth.unauthorized", "auth-service", "blocked", ip_address=ip_address, details={"reason": "invalid_token"})
        raise authentication_error() from None

    if not token_jti or is_token_revoked(db, token_jti):
        send_audit_event("auth.unauthorized", "auth-service", "blocked", user_id=user_id, ip_address=ip_address, details={"reason": "revoked_token"})
        raise authentication_error()

    user = get_user_by_id(db, user_id)
    if not user or not user.is_active:
        send_audit_event("auth.unauthorized", "auth-service", "blocked", user_id=user_id, ip_address=ip_address, details={"reason": "inactive_or_missing_user"})
        raise authentication_error()

    return AuthContext(
        user=user,
        token=token,
        token_jti=token_jti,
        expires_at=expires_at,
        payload=payload,
        ip_address=ip_address,
    )


def get_current_user(context: AuthContext = Depends(get_current_auth_context)) -> User:
    return context.user


def require_admin(context: AuthContext = Depends(get_current_auth_context)) -> User:
    effective_role = effective_user_role(context.user)
    token_role = str(context.payload.get("role") or "").lower()
    if not user_has_role(context.user, "admin") and token_role != "admin" and effective_role != "admin":
        send_audit_event(
            "auth.admin.denied",
            "auth-service",
            "blocked",
            user_id=context.user.id,
            ip_address=context.ip_address,
            details={"email": context.user.email, "role": effective_role},
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required.",
        )

    return context.user
