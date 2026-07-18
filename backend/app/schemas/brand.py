"""Brand schemas."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class BrandCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    logo: str | None = Field(default=None, max_length=8)
    description: str | None = None
    client_type: str = "Retainer"
    priority: str = "P3"
    short_term_goals: list[str] = Field(default_factory=list)
    long_term_goals: list[str] = Field(default_factory=list)
    journey: list[str] = Field(default_factory=list)
    responsibilities: str | None = None
    assigned_members: list[uuid.UUID] = Field(default_factory=list)


class BrandUpdate(BaseModel):
    name: str | None = None
    logo: str | None = None
    description: str | None = None
    client_type: str | None = None
    priority: str | None = None
    short_term_goals: list[str] | None = None
    long_term_goals: list[str] | None = None
    journey: list[str] | None = None
    responsibilities: str | None = None
    assigned_members: list[uuid.UUID] | None = None


class BrandOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    logo: str | None
    description: str | None
    client_type: str
    priority: str
    short_term_goals: list[str]
    long_term_goals: list[str]
    journey: list[str]
    responsibilities: str | None
    assigned_members: list[uuid.UUID]
    created_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
