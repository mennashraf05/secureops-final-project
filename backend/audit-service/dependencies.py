from dataclasses import dataclass
from secrets import compare_digest

from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from shared.audit_client import send_audit_event
from shared.config import settings
from shared.request_utils import get_client_ip


bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class CurrentUser:
    id: int
    role: str
    payload: dict


def authentication_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def require_internal_api_key(x_internal_api_key: str | None = Header(default=None)) -> None:
    if not x_internal_api_key or not compare_digest(x_internal_api_key, settings.internal_api_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal API key.",
        )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> CurrentUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise authentication_error()

    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            leeway=10
        )
        user_id = int(payload.get("sub", ""))
        role = str(payload.get("role", ""))
    except (JWTError, TypeError, ValueError):
        raise authentication_error() from None

    if not user_id or role not in {"admin", "user"}:
        raise authentication_error()

    return CurrentUser(id=user_id, role=role, payload=payload)


def require_admin(
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
) -> CurrentUser:
    if current_user.role != "admin":
        send_audit_event(
            "audit.admin.denied",
            "audit-service",
            "blocked",
            user_id=current_user.id,
            ip_address=get_client_ip(request),
            details={
                "reason": "Admin privileges required",
                "path": request.url.path,
            },
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required.",
        )

    return current_user
