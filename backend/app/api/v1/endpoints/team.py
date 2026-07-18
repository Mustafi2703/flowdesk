"""Team management and user onboarding.

Role rules (mirrors the requirements doc):

- Owner can create, edit, deactivate, and reset password for ANY user
  (including other owners, managers, HR, accountant).
- Manager can create users with role `team` only
  (the day-to-day onboarding path). They cannot create privileged accounts.
- HR can reset passwords for non-privileged users (team) and
  toggle is_active. HR cannot create new accounts.
- Departments / roles in use: Owner, Manager, Team, Accounts (accountant), HR.
  Developer is legacy-only and not assignable for new users.
- Other roles cannot mutate the user directory at all.
"""

from __future__ import annotations

import secrets
import string
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.core.roles import Role
from app.core.security import hash_password
from app.db.session import get_db
from app.api.v1.endpoints import departments as team_departments
from app.models.department import Department
from app.models.notification import Notification
from app.models.profile import Profile
from app.models.task import Task
from app.schemas.profile import ProfileCreate, ProfileOut, ProfileUpdate
from app.utils.queues import DASHBOARD_CACHE

router = APIRouter(prefix="/team", tags=["team"])
router.include_router(team_departments.router)


# ── Role-allowlists for who-can-create-whom ─────────────────────────────────
_MANAGER_ASSIGNABLE: frozenset[Role] = frozenset({Role.TEAM})
_OWNER_ASSIGNABLE: frozenset[Role] = frozenset(
    {Role.OWNER, Role.MANAGER, Role.TEAM, Role.HR, Role.ACCOUNTANT}
)


_MANAGEMENT_ROLES: frozenset[Role] = frozenset({Role.OWNER, Role.MANAGER})


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


def _resolve_manager_id(
    db: Session,
    *,
    actor: Profile,
    new_role: Role,
    requested_manager_id: uuid.UUID | None,
) -> uuid.UUID | None:
    """Owner picks a manager; managers auto-assign themselves as manager."""
    actor_role = Role(actor.role)
    if actor_role is Role.MANAGER:
        return actor.id
    if actor_role is not Role.OWNER:
        return None
    if requested_manager_id is None:
        return None
    manager = db.get(Profile, requested_manager_id)
    if not manager or not manager.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid manager")
    if Role(manager.role) not in _MANAGEMENT_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Manager must be an owner or manager account",
        )
    return manager.id


def _resolve_department_for_user(
    db: Session,
    *,
    actor: Profile,
    department_id: uuid.UUID | None,
    department_name: str | None,
    manager_id: uuid.UUID | None,
) -> tuple[str | None, uuid.UUID | None]:
    if department_id is None:
        return department_name, manager_id
    dept = db.get(Department, department_id)
    if not dept:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid department")
    actor_role = Role(actor.role)
    if actor_role is Role.MANAGER and dept.manager_id != actor.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only assign users to departments you manage",
        )
    resolved_manager = manager_id
    if resolved_manager is None and dept.manager_id is not None:
        resolved_manager = dept.manager_id
    return dept.name, resolved_manager


def _team_query_for(user: Profile, include_inactive: bool):
    stmt = select(Profile).order_by(Profile.is_active.desc(), Profile.name)
    if not include_inactive:
        stmt = stmt.where(Profile.is_active.is_(True))
    role = Role(user.role)
    if role is Role.MANAGER:
        stmt = stmt.where(or_(Profile.manager_id == user.id, Profile.id == user.id))
    return stmt


# ── Reads ───────────────────────────────────────────────────────────────────
@router.get("", response_model=list[ProfileOut])
def list_team(
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
    include_inactive: bool = False,
) -> list[Profile]:
    _require_team_view(user)
    stmt = _team_query_for(user, include_inactive)
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
    department_name, manager_id = _resolve_department_for_user(
        db,
        actor=user,
        department_id=payload.department_id,
        department_name=payload.department,
        manager_id=payload.manager_id,
    )
    manager_id = _resolve_manager_id(
        db, actor=user, new_role=new_role, requested_manager_id=manager_id
    )
    profile = Profile(
        name=payload.name.strip(),
        email=email,
        password_hash=hash_password(plain_password),
        role=new_role.value,
        department=department_name,
        designation=payload.designation,
        avatar=(payload.avatar or payload.name[:2]).upper(),
        leaves_total=payload.leaves_total,
        manager_id=manager_id,
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
def _manager_can_edit(actor: Profile, profile: Profile) -> bool:
    if Role(profile.role) not in _MANAGER_ASSIGNABLE:
        return False
    return profile.manager_id == actor.id


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

    if "department_id" in incoming:
        dept_name, resolved_mgr = _resolve_department_for_user(
            db,
            actor=user,
            department_id=incoming.pop("department_id"),
            department_name=incoming.get("department", profile.department),
            manager_id=incoming.get("manager_id", profile.manager_id),
        )
        incoming["department"] = dept_name
        if resolved_mgr is not None and "manager_id" not in incoming:
            incoming["manager_id"] = resolved_mgr

    # Owner can edit any user.
    if role is Role.OWNER:
        if "manager_id" in incoming and incoming["manager_id"] is not None:
            incoming["manager_id"] = _resolve_manager_id(
                db,
                actor=user,
                new_role=Role(incoming.get("role") or profile.role),
                requested_manager_id=incoming["manager_id"],
            )
        for key, value in incoming.items():
            setattr(profile, key, value)
        db.commit()
        db.refresh(profile)
        DASHBOARD_CACHE.invalidate()
        return profile

    # Managers can edit their direct reports (team/developer).
    manager_fields = {"name", "department", "designation", "is_active", "department_id"}
    if role is Role.MANAGER and set(incoming.keys()).issubset(manager_fields):
        if not _manager_can_edit(user, profile):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Can only edit your direct reports")
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


@router.get("/managers", response_model=list[ProfileOut])
def list_managers(db: Session = Depends(get_db), user: Profile = Depends(get_current_user)) -> list[Profile]:
    """Assignable managers for onboarding (owner assigns reporting line)."""
    if Role(user.role) is not Role.OWNER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Owner only")
    return db.scalars(
        select(Profile)
        .where(
            Profile.is_active.is_(True),
            Profile.role.in_([Role.OWNER.value, Role.MANAGER.value]),
        )
        .order_by(Profile.name)
    ).all()


@router.get("/reports", response_model=list[ProfileOut])
def my_reports(db: Session = Depends(get_db), user: Profile = Depends(get_current_user)) -> list[Profile]:
    """Direct reports for the signed-in manager."""
    if Role(user.role) not in {Role.OWNER, Role.MANAGER}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Managers only")
    return db.scalars(
        select(Profile)
        .where(Profile.is_active.is_(True), Profile.manager_id == user.id)
        .order_by(Profile.name)
    ).all()


# Compatibility alias — the Next.js UI fetches /api/users, which the
# frontend proxies to /api/v1/users. We also keep a redirect-friendly alias
# under /team/active so the same data is accessible inside this router.
@router.get("/active", response_model=list[ProfileOut])
def list_active(db: Session = Depends(get_db), user: Profile = Depends(get_current_user)) -> list[Profile]:
    _require_team_view(user)
    return db.scalars(
        select(Profile).where(Profile.is_active.is_(True)).order_by(Profile.name)
    ).all()
