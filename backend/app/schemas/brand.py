"""Brand schemas."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

WORKFLOW_STAGES = (
    "assigned",
    "design",
    "content",
    "editing",
    "approval",
    "delivered",
)


class BrandCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    logo: str | None = Field(default=None, max_length=8)
    description: str | None = None
    client_type: str = "Retainer"
    priority: str = "P3"
    workflow_stage: str = "assigned"
    short_term_goals: list[str] = Field(default_factory=list)
    long_term_goals: list[str] = Field(default_factory=list)
    journey: list[str] = Field(default_factory=list)
    fonts: str | None = None
    logo_variants: list[str] = Field(default_factory=list)
    brand_colors: str | None = None
    photography_style: str | None = None
    brand_voice: str | None = None
    responsibilities: str | None = None
    assigned_members: list[uuid.UUID] = Field(default_factory=list)


class BrandUpdate(BaseModel):
    name: str | None = None
    logo: str | None = Field(default=None, max_length=8)
    description: str | None = None
    client_type: str | None = None
    priority: str | None = None
    workflow_stage: str | None = None
    short_term_goals: list[str] | None = None
    long_term_goals: list[str] | None = None
    journey: list[str] | None = None
    fonts: str | None = None
    logo_variants: list[str] | None = None
    brand_colors: str | None = None
    photography_style: str | None = None
    brand_voice: str | None = None
    responsibilities: str | None = None
    assigned_members: list[uuid.UUID] | None = None


class BrandOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    logo: str | None
    logo_url: str | None
    description: str | None
    client_type: str
    priority: str
    workflow_stage: str
    short_term_goals: list[str]
    long_term_goals: list[str]
    journey: list[str]
    fonts: str | None
    logo_variants: list[str]
    brand_colors: str | None
    photography_style: str | None
    brand_voice: str | None
    responsibilities: str | None
    assigned_members: list[uuid.UUID]
    created_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
