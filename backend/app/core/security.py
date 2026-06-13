"""Password hashing + JWT issuing/verifying.

Uses passlib with bcrypt for hashing and python-jose for JWT.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=10)


def hash_password(plain: str) -> str:
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_context.verify(plain, hashed)


def create_access_token(
    subject: str,
    *,
    role: str,
    name: str,
    email: str,
    avatar: str | None,
    expires_delta: timedelta | None = None,
) -> str:
    """Issue a JWT compatible with the Next.js frontend.

    The Next.js side signs the SessionUser object directly with jsonwebtoken,
    so we mirror that layout (id, name, email, role, avatar) and rely on the
    standard `exp`/`iat` claims for validity.
    """
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.jwt_expires_minutes)
    )
    payload: dict[str, Any] = {
        "id": subject,
        "name": name,
        "email": email,
        "role": role,
        "avatar": avatar,
        "iat": int(datetime.now(timezone.utc).timestamp()),
        "exp": int(expire.timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
    except JWTError as exc:  # pragma: no cover — fast-fail
        raise ValueError(f"invalid token: {exc}") from exc
