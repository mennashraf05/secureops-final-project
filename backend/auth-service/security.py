from datetime import datetime, timedelta, timezone
import base64
import hmac
import hashlib
import secrets
import struct
import time
from urllib.parse import quote
from uuid import uuid4

from jose import JWTError, jwt
from passlib.context import CryptContext

from models import User
from shared.config import settings


password_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return password_context.hash(password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    return password_context.verify(plain_password, password_hash)


def hash_code(code: str) -> str:
    return password_context.hash(code)


def verify_code(plain_code: str, code_hash: str) -> bool:
    return password_context.verify(plain_code, code_hash)


def generate_totp_secret() -> str:
    return base64.b32encode(secrets.token_bytes(20)).decode("ascii").rstrip("=")


def _totp_at(secret: str, counter: int, digits: int = 6) -> str:
    padding = "=" * ((8 - len(secret) % 8) % 8)
    key = base64.b32decode((secret + padding).upper())
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    value = struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF
    return str(value % (10 ** digits)).zfill(digits)


def verify_totp(secret: str, code: str, window: int = 1) -> bool:
    if not code.isdigit() or len(code) != 6:
        return False
    counter = int(time.time() // 30)
    return any(hmac.compare_digest(_totp_at(secret, counter + drift), code) for drift in range(-window, window + 1))


def totp_uri(secret: str, email: str, issuer: str = "SecureOps") -> str:
    label = f"{issuer}:{email}"
    return (
        f"otpauth://totp/{quote(label, safe=':')}"
        f"?secret={secret.upper()}"
        f"&issuer={quote(issuer, safe='')}"
    )


def create_access_token(user: User) -> tuple[str, str, datetime, int]:
    expires_delta = timedelta(minutes=settings.access_token_expire_minutes)
    expires_at = datetime.now(timezone.utc) + expires_delta
    token_jti = uuid4().hex
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
        "jti": token_jti,
        "exp": expires_at,
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, token_jti, expires_at, int(expires_delta.total_seconds())


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise ValueError("Invalid or expired token.") from exc
