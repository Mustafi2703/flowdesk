"""Department schemas."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DepartmentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    description: str | None = Field(default=None, max_length=500)
    manager_id: uuid.UUID | None = None


class DepartmentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    description: str | None = None
    manager_id: uuid.UUID | None = None


class DepartmentManagerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    role: str
    email: str


class DepartmentOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    manager_id: uuid.UUID | None
    manager: DepartmentManagerOut | None = None
    member_count: int = 0
    created_at: datetime
