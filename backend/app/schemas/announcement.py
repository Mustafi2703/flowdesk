"""Announcement schemas."""

from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class AnnouncementCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1)
    priority: str = "Normal"
    event_date: date | None = None
    image_url: str | None = None
    link_url: str | None = None

    @field_validator("image_url", "link_url")
    @classmethod
    def _empty_url_to_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed or None


class AnnouncementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    body: str
    priority: str
    created_by: uuid.UUID | None
    read_by: list[uuid.UUID]
    event_date: date | None = None
    image_url: str | None = None
    link_url: str | None = None
    created_at: datetime
    updated_at: datetime
