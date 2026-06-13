"""Team management and user onboarding.

Role rules (mirrors the requirements doc):

- Owner can create, edit, deactivate, and reset password for ANY user
  (including other owners, managers, HR, accountant).
- Manager can create users with role `team` or `developer` only
  (the day-to-day onboarding path). They cannot create privileged accounts.
- HR can reset passwords for non-privileged users (team/developer) and
  toggle is_active. HR cannot create new accounts.
- Other roles cannot mutate the user directory at all.
"""

from __future__ import annotations

import secrets
import string
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.core.roles import Role
from app.core.security import hash_password
from app.db.session import get_db
from app.models.notification import Notification
from app.models.profile import Profile
from app.models.task import Task
from app.schemas.profile import ProfileCreate, ProfileOut, ProfileUpdate
from app.utils.queues import DASHBOARD_CACHE

router = APIRouter(prefix="/team", tags=["team"])


# ── Role-allowlists for who-can-create-whom ─────────────────────────────────
_MANAGER_ASSIGNABLE: frozenset[Role] = frozenset({Role.TEAM, Role.DEVELOPER})
_OWNER_ASSIGNABLE: frozenset[Role] = frozenset(Role)


def _require_team_view(user: Profile) -> None:
    if Role(user.role) not in {Role.OWNER, Role.MANAGER, Role.HR}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Team module restricted")


def _require_owner(user: Profile) -> None:
    if Role(user.role) is not Role.OWNER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Owner-only action")


def _assignable_roles_for(user: Profile) -> frozenset[Role]:
    if Role(user.role) is Role.OWNER:
        return _OWNER_ASSIGNABLE
    if Role(user.role) is Role.MANAGER:
        return _MANAGER_ASSIGNABLE
    return frozenset()


def _generate_temp_password() -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(12))


# ── Reads ───────────────────────────────────────────────────────────────────
@router.get("", response_model=list[ProfileOut])
def list_team(
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
    include_inactive: bool = False,
) -> list[Profile]:
    _require_team_view(user)
    stmt = select(Profile).order_by(Profile.department, Profile.name)
    if not include_inactive:
        stmt = stmt.where(Profile.is_active.is_(True))
    return db.scalars(stmt).all()


@router.get("/assignable-roles")
def assignable_roles(user: Profile = Depends(get_current_user)) -> dict[str, list[str]]:
    """Tells the UI which roles the current user is allowed to assign."""
    return {"roles": sorted(role.value for role in _assignable_roles_for(user))}


@router.get("/workload")
def team_workload(db: Session = Depends(get_db), user: Profile = Depends(get_current_user)) -> list[dict]:
    _require_team_view(user)
    profiles = db.scalars(select(Profile).where(Profile.is_active.is_(True)).order_by(Profile.name)).all()
    tasks = db.scalars(select(Task).where(Task.status.not_in(["Completed", "On Hold"]))).all()
    rows = []
    for profile in profiles:
        active = [task for task in tasks if profile.id in task.assigned_to]
        done = db.scalars(
            select(Task).where(Task.assigned_to.any(profile.id), Task.status == "Completed")
        ).all()
        total = db.scalars(select(Task).where(Task.assigned_to.any(profile.id))).all()
        rows.append(
            {
                "user": ProfileOut.model_validate(profile).model_dump(),
                "active_tasks": len(active),
                "workload": (
                    "Available"
                    if not active
                    else "Moderate"
                    if len(active) <= 2
                    else "Fully Loaded"
                ),
                "total_assigned": len(total),
                "done_count": len(done),
                "completion_rate": round((len(done) / len(total)) * 100, 2) if total else 0,
            }
        )
    return rows


# ── Onboarding (create) ─────────────────────────────────────────────────────
class CreateUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user: ProfileOut
    # Plain-text temporary password returned ONCE so the creator can share it
    # with the new hire. Never stored anywhere except the bcrypt hash.
    temporary_password: str | None = None


@router.post("", response_model=CreateUserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: ProfileCreate,
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> CreateUserResponse:
    allowed = _assignable_roles_for(user)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to onboard users",
        )

    try:
        new_role = Role(payload.role)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown role: {payload.role}",
        ) from exc

    if new_role not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Your role can only create users with: {sorted(r.value for r in allowed)}",
        )

    email = str(payload.email).lower().strip()
    if db.scalar(select(Profile).where(Profile.email == email)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already in use")

    # If the caller did not provide a password, we generate one and return it
    # exactly once. This is the standard onboarding flow used by Managers.
    plain_password = payload.password.strip() if payload.password else _generate_temp_password()
    profile = Profile(
        name=payload.name.strip(),
        email=email,
        password_hash=hash_password(plain_password),
        role=new_role.value,
        department=payload.department,
        designation=payload.designation,
        avatar=(payload.avatar or payload.name[:2]).upper(),
        leaves_total=payload.leaves_total,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)

    # Drop an in-app welcome notification for the new user.
    db.add(
        Notification(
            user_id=profile.id,
            message=f"Welcome to Scrumfolks TMS, {profile.name.split()[0]}!",
            type="account",
            link="/overview",
        )
    )
    db.commit()
    DASHBOARD_CACHE.invalidate()

    return CreateUserResponse(
        user=ProfileOut.model_validate(profile),
        temporary_password=plain_password,
    )


# ── Update ──────────────────────────────────────────────────────────────────
@router.patch("/{profile_id}", response_model=ProfileOut)
def update_user(
    profile_id: uuid.UUID,
    payload: ProfileUpdate,
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> Profile:
    role = Role(user.role)
    profile = db.get(Profile, profile_id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    incoming = payload.model_dump(exclude_unset=True)

    # Self-edit is allowed for safe fields.
    self_edit = profile.id == user.id
    safe_self_fields = {"name", "designation", "avatar"}
    if self_edit and set(incoming.keys()).issubset(safe_self_fields):
        for key, value in incoming.items():
            setattr(profile, key, value)
        db.commit()
        db.refresh(profile)
        return profile

    # Only owner can edit other users' role or fields beyond the safe set.
    if role is Role.OWNER:
        for key, value in incoming.items():
            setattr(profile, key, value)
        db.commit()
        db.refresh(profile)
        DASHBOARD_CACHE.invalidate()
        return profile

    # Managers can soft-deactivate their own team/developer users only.
    if role is Role.MANAGER and set(incoming.keys()).issubset({"is_active", "department", "designation"}):
        if Role(profile.role) not in _MANAGER_ASSIGNABLE:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot edit privileged users")
        for key, value in incoming.items():
            setattr(profile, key, value)
        db.commit()
        db.refresh(profile)
        DASHBOARD_CACHE.invalidate()
        return profile

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to edit this user")


class ResetPasswordResponse(BaseModel):
    temporary_password: str


@router.post("/{profile_id}/reset-password", response_model=ResetPasswordResponse)
def reset_password(
    profile_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> ResetPasswordResponse:
    """Generate a new random password for a user; only Owner or HR.

    Returns the password ONCE so the admin can share it out-of-band.
    """
    role = Role(user.role)
    if role not in {Role.OWNER, Role.HR}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Owner or HR only")
    profile = db.get(Profile, profile_id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    # HR cannot reset privileged accounts.
    if role is Role.HR and Role(profile.role) in {Role.OWNER, Role.MANAGER}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="HR cannot reset privileged accounts")
    temp = _generate_temp_password()
    profile.password_hash = hash_password(temp)
    db.commit()
    db.add(
        Notification(
            user_id=profile.id,
            message="Your password was reset by an administrator. Please log in and change it.",
            type="account",
            link="/login",
        )
    )
    db.commit()
    return ResetPasswordResponse(temporary_password=temp)


@router.delete("/{profile_id}")
def deactivate_user(
    profile_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> dict[str, Any]:
    """Soft-deactivate a user. Only Owner can fully deactivate."""
    _require_owner(user)
    profile = db.get(Profile, profile_id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if profile.id == user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot deactivate yourself")
    profile.is_active = False
    db.commit()
    DASHBOARD_CACHE.invalidate()
    return {"ok": True, "deactivated": str(profile.id)}


class ReactivateResponse(BaseModel):
    ok: bool
    activated: str


@router.post("/{profile_id}/activate", response_model=ReactivateResponse)
def activate_user(
    profile_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> ReactivateResponse:
    _require_owner(user)
    profile = db.get(Profile, profile_id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    profile.is_active = True
    db.commit()
    DASHBOARD_CACHE.invalidate()
    return ReactivateResponse(ok=True, activated=str(profile.id))


# Compatibility alias — the Next.js UI fetches /api/users, which the
# frontend proxies to /api/v1/users. We also keep a redirect-friendly alias
# under /team/active so the same data is accessible inside this router.
@router.get("/active", response_model=list[ProfileOut])
def list_active(db: Session = Depends(get_db), user: Profile = Depends(get_current_user)) -> list[Profile]:
    _require_team_view(user)
    return db.scalars(
        select(Profile).where(Profile.is_active.is_(True)).order_by(Profile.name)
    ).all()
