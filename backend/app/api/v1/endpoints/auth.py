"""Authentication endpoints."""

# NOTE: Do NOT add `from __future__ import annotations` here. The login/
# change-password handlers are wrapped by slowapi's `@limiter.limit`
# decorator (functools.wraps). With stringized annotations FastAPI resolves
# type hints against slowapi's module globals, fails to find the request
# body models, and silently demotes them to query params (HTTP 422). Eager
# annotations keep the Pydantic body models resolvable.

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.core.config import settings
from app.core.rate_limit import limiter
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models.profile import Profile
from app.schemas.auth import LoginRequest, SessionUser, TokenResponse
from app.schemas.profile import PasswordChange

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
@limiter.limit("10/minute")
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> dict:
    """Return `{ user }` — same shape the Next.js login page expects."""
    user = db.scalar(select(Profile).where(Profile.email == payload.email.lower(), Profile.is_active.is_(True)))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    session_user = {
        "id": str(user.id),
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "avatar": user.avatar,
    }
    token = create_access_token(
        str(user.id),
        role=user.role,
        name=user.name,
        email=user.email,
        avatar=user.avatar,
        expires_delta=timedelta(minutes=settings.jwt_expires_minutes),
    )
    response.set_cookie(
        settings.cookie_name,
        token,
        max_age=settings.jwt_expires_minutes * 60,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        domain=settings.cookie_domain,
        path="/",
    )
    return {"user": session_user, "access_token": token}


@router.post("/logout")
def logout(response: Response) -> dict[str, bool]:
    response.delete_cookie(
        settings.cookie_name,
        domain=settings.cookie_domain,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
    )
    return {"ok": True}


@router.get("/me", response_model=SessionUser)
def me(user: Profile = Depends(get_current_user)) -> Profile:
    return user


@router.post("/change-password")
@limiter.limit("20/hour")
def change_password(
    payload: PasswordChange,
    request: Request,
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> dict[str, bool]:
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is wrong")
    user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"ok": True}
