"""Shared FastAPI dependencies."""

from __future__ import annotations

import uuid
from collections.abc import Callable

from fastapi import Cookie, Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.roles import Role
from app.core.security import decode_token
from app.db.session import get_db
from app.models.profile import Profile

bearer_scheme = HTTPBearer(auto_error=False)


def _token_from_request(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None,
    cookie_token: str | None,
) -> str | None:
    if credentials:
        return credentials.credentials
    if cookie_token:
        return cookie_token
    return request.headers.get("x-access-token")


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    cookie_token: str | None = Cookie(default=None, alias=settings.cookie_name),
) -> Profile:
    token = _token_from_request(request, credentials, cookie_token)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    try:
        payload = decode_token(token)
        # Frontend JWTs sign the user object directly with `id`. Backend tokens
        # also write `id`. Fall back to `sub` for compatibility.
        raw_id = payload.get("id") or payload.get("sub")
        user_id = uuid.UUID(str(raw_id))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session") from exc

    user = db.scalar(select(Profile).where(Profile.id == user_id, Profile.is_active.is_(True)))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def require_roles(*roles: Role) -> Callable[[Profile], Profile]:
    allowed = {role.value for role in roles}

    def dependency(user: Profile = Depends(get_current_user)) -> Profile:
        if user.role not in allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return user

    return dependency


def require_cron_secret(x_cron_secret: str | None = Header(default=None)) -> None:
    if x_cron_secret != settings.cron_secret:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid cron secret")
