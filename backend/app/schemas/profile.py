"""Profile schemas."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ProfileBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    role: str
    department: str | None = None
    designation: str | None = None
    avatar: str | None = Field(default=None, max_length=8)


class ProfileCreate(ProfileBase):
    # Optional: when omitted the backend generates a one-shot temporary
    # password and returns it to the caller (manager onboarding flow).
    password: str | None = Field(default=None, min_length=8, max_length=128)
    leaves_total: int = 21
    manager_id: uuid.UUID | None = None


class ProfileUpdate(BaseModel):
    name: str | None = None
    department: str | None = None
    designation: str | None = None
    avatar: str | None = None
    role: str | None = None
    is_active: bool | None = None
    leaves_total: int | None = None
    manager_id: uuid.UUID | None = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class ProfileOut(ProfileBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    is_active: bool
    leaves_total: int
    leaves_taken: int
    manager_id: uuid.UUID | None = None
    created_at: datetime
