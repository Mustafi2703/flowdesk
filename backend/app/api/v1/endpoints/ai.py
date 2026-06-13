"""AI endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.core.roles import Role
from app.db.session import get_db
from app.models.brand import Brand
from app.models.profile import Profile
from app.services.ai import write_task_description

router = APIRouter(prefix="/ai", tags=["ai"])


class TaskDescriptionRequest(BaseModel):
    title: str = Field(min_length=1)
    brand_id: str | None = None
    task_type: str | None = None
    type: str | None = None  # alias sent by the frontend modal


@router.post("/task-description")
def task_description(
    payload: TaskDescriptionRequest,
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> dict[str, str]:
    if Role(user.role) not in {Role.OWNER, Role.MANAGER}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owner/manager can use AI write")
    brand = None
    if payload.brand_id:
        try:
            brand = db.get(Brand, uuid.UUID(payload.brand_id))
        except ValueError:
            brand = None
    task_type = payload.task_type or payload.type
    return {
        "description": write_task_description(
            title=payload.title,
            brand_name=brand.name if brand else None,
            task_type=task_type,
        )
    }
