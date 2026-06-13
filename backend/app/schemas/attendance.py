"""Attendance schemas."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class AttendanceClockOut(BaseModel):
    notes: str | None = None


class AttendanceLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    date: date
    login_time: datetime | None
    logout_time: datetime | None
    hours_worked: Decimal | None
    notes: str | None
    created_at: datetime
    updated_at: datetime
