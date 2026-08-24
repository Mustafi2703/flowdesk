"""Client meeting schemas."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

RecurrenceKind = Literal["none", "weekly", "monthly", "quarterly", "yearly"]


class MeetingCreate(BaseModel):
    brand_id: uuid.UUID
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    client_email: EmailStr | None = None
    attendee_emails: list[EmailStr] = Field(default_factory=list)
    start_at: datetime
    duration_minutes: int = Field(default=30, ge=15, le=480)
    recurrence: RecurrenceKind = "none"
    recurrence_count: int | None = Field(default=None, ge=1, le=52)


class MeetingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    brand_id: uuid.UUID
    title: str
    description: str | None
    client_email: str
    attendee_emails: list[str]
    start_at: datetime
    duration_minutes: int
    recurrence: str
    recurrence_count: int | None
    google_event_id: str | None
    google_meet_link: str | None
    google_calendar_link: str | None
    created_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    brand_name: str | None = None
