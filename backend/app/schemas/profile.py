"""Profile schemas."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator, field_validator


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
    manager_ids: list[uuid.UUID] = Field(default_factory=list)
    department_id: uuid.UUID | None = None

    @model_validator(mode='before')
    @classmethod
    def normalize_create(cls, data):
        if not isinstance(data, dict):
            return data
        data = dict(data)
        pw = data.get('password')
        if isinstance(pw, str) and not pw.strip():
            data['password'] = None
        mgrs = data.get('manager_ids')
        if isinstance(mgrs, list):
            data['manager_ids'] = [m for m in mgrs if m]
        return data

    @field_validator("password", mode="before")
    @classmethod
    def _empty_password_is_none(cls, value: object) -> object:
        if value is None:
            return None
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @field_validator("manager_id", mode="before")
    @classmethod
    def _empty_manager_id_is_none(cls, value: object) -> object:
        if value is None:
            return None
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @field_validator("manager_ids", mode="before")
    @classmethod
    def _drop_blank_manager_ids(cls, value: object) -> object:
        if not isinstance(value, list):
            return value
        cleaned: list[object] = []
        for item in value:
            if item is None:
                continue
            if isinstance(item, str) and not item.strip():
                continue
            cleaned.append(item)
        return cleaned


class ProfileUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    department: str | None = None
    department_id: uuid.UUID | None = None
    designation: str | None = None
    avatar: str | None = None
    role: str | None = None
    is_active: bool | None = None
    leaves_total: int | None = None
    manager_id: uuid.UUID | None = None
    manager_ids: list[uuid.UUID] | None = None


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
    manager_ids: list[uuid.UUID] = Field(default_factory=list)
    created_at: datetime

    @field_validator('manager_ids', mode='before')
    @classmethod
    def coerce_manager_ids(cls, value):
        return value if value is not None else []

    @classmethod
    def from_profile(cls, profile) -> "ProfileOut":
        """Safe serializer — legacy rows may have NULL manager_ids."""
        return cls.model_validate(profile)
