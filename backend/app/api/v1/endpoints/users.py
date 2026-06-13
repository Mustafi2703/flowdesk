"""User directory endpoint — read-only listing of active profiles."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.db.session import get_db
from app.models.profile import Profile

router = APIRouter(prefix="/users", tags=["users"])


@router.get("")
def list_users(
    db: Session = Depends(get_db),
    _user: Profile = Depends(get_current_user),
) -> list[dict[str, Any]]:
    rows = db.scalars(
        select(Profile).where(Profile.is_active.is_(True)).order_by(Profile.name)
    ).all()
    return [
        {
            "id": str(row.id),
            "name": row.name,
            "email": row.email,
            "role": row.role,
            "department": row.department,
            "designation": row.designation,
            "avatar": row.avatar,
            "is_active": row.is_active,
            "leaves_total": row.leaves_total,
            "leaves_taken": row.leaves_taken,
        }
        for row in rows
    ]
