"""Announcement schemas."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AnnouncementCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1)
    priority: str = "Normal"


class AnnouncementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    body: str
    priority: str
    created_by: uuid.UUID | None
    read_by: list[uuid.UUID]
    created_at: datetime
    updated_at: datetime
