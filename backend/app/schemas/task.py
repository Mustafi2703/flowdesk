"""Task and task-chat schemas."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ChecklistItem(BaseModel):
    id: str
    text: str
    done: bool = False


class SubTask(BaseModel):
    # Stored as free-form JSONB on the task. Keys mirror what the Dev Board
    # and visibility checks read: `assigned_to` (list of user ids) and a
    # Title-Case `status`.
    model_config = ConfigDict(extra="allow")

    id: str | None = None
    title: str
    assigned_to: list[str] = Field(default_factory=list)
    status: str = "Not Started"
    due_date: str | None = None


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    brand_id: uuid.UUID | None = None
    assigned_to: list[uuid.UUID] = Field(default_factory=list)
    assigned_managers: list[uuid.UUID] = Field(default_factory=list)
    type: str = "Other"
    task_mode: str = "standard"
    priority: str = "Medium"
    status: str = "Not Started"
    start_date: date | None = None
    due_date: date | None = None
    requires_review: bool = True
    is_billable: bool = False
    checklist: list[ChecklistItem] = Field(default_factory=list)
    sub_tasks: list[SubTask] = Field(default_factory=list)
    recurring_config: dict[str, Any] | None = None


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    brand_id: uuid.UUID | None = None
    assigned_to: list[uuid.UUID] | None = None
    assigned_managers: list[uuid.UUID] | None = None
    type: str | None = None
    task_mode: str | None = None
    priority: str | None = None
    status: str | None = None
    start_date: date | None = None
    due_date: date | None = None
    requires_review: bool | None = None
    is_billable: bool | None = None
    checklist: list[ChecklistItem] | None = None
    sub_tasks: list[SubTask] | None = None
    recurring_config: dict[str, Any] | None = None
    flagged: bool | None = None


class TaskStatusUpdate(BaseModel):
    status: str
    note: str | None = None


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    description: str | None
    brand_id: uuid.UUID | None
    assigned_to: list[uuid.UUID]
    assigned_managers: list[uuid.UUID]
    created_by: uuid.UUID | None
    type: str
    task_mode: str
    priority: str
    status: str
    start_date: date | None
    due_date: date | None
    requires_review: bool
    is_billable: bool
    billable_amount: Decimal | None
    billed_at: datetime | None
    checklist: list[dict[str, Any]]
    sub_tasks: list[dict[str, Any]]
    timeline: list[dict[str, Any]]
    recurring_config: dict[str, Any] | None
    flagged: bool
    created_at: datetime
    updated_at: datetime

    @field_validator("billable_amount")
    @classmethod
    def _hide_decimal_artifacts(cls, value: Decimal | None) -> Decimal | None:
        return value


class TaskChatSend(BaseModel):
    message: str | None = None
    type: str = "text"
    voice_url: str | None = None
    duration: int | None = None


class TaskChatOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    task_id: uuid.UUID
    sender_id: uuid.UUID
    message: str | None
    type: str
    voice_url: str | None
    duration: int | None
    created_at: datetime
