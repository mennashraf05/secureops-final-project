from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from shared.config import settings


bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class CurrentUserPayload:
    user_id: int
    email: str
    role: str
    jti: str | None


def authentication_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user_payload(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> CurrentUserPayload:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise authentication_error()

    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        user_id = int(payload.get("sub", ""))
        email = str(payload.get("email", ""))
        role = str(payload.get("role", ""))
        jti = payload.get("jti")
    except (JWTError, TypeError, ValueError):
        raise authentication_error() from None

    if not user_id or not email or role not in {"admin", "user"}:
        raise authentication_error()

    return CurrentUserPayload(
        user_id=user_id,
        email=email,
        role=role,
        jti=str(jti) if jti else None,
    )


def require_admin(
    current_user: CurrentUserPayload = Depends(get_current_user_payload),
) -> CurrentUserPayload:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required.",
        )

    return current_user
