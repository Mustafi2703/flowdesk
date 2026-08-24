"""User directory endpoint — read-only listing of active profiles."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.core.roles import Role
from app.db.session import get_db
from app.models.profile import Profile

router = APIRouter(prefix="/users", tags=["users"])


def _serialize_user(row: Profile, viewer_role: Role) -> dict[str, Any]:
    base: dict[str, Any] = {
        "id": str(row.id),
        "name": row.name,
        "role": row.role,
        "avatar": row.avatar,
        "department": row.department,
        "designation": row.designation,
        "is_active": row.is_active,
    }
    if viewer_role in {Role.OWNER, Role.MANAGER, Role.HR}:
        return {
            **base,
            "email": row.email,
            "leaves_total": row.leaves_total,
            "leaves_taken": row.leaves_taken,
        }
    if viewer_role is Role.ACCOUNTANT:
        return {**base, "email": row.email}
    return base


@router.get("")
def list_users(
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> list[dict[str, Any]]:
    rows = db.scalars(
        select(Profile).where(Profile.is_active.is_(True)).order_by(Profile.name)
    ).all()
    role = Role(user.role)
    return [_serialize_user(row, role) for row in rows]
