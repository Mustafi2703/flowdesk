"""Task and TaskChat models — the heart of the system."""

from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampsMixin, UUIDPKMixin


class Task(UUIDPKMixin, TimestampsMixin, Base):
    __tablename__ = "tasks"

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    brand_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("brands.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    assigned_to: Mapped[list[uuid.UUID]] = mapped_column(
        ARRAY(UUID(as_uuid=True)),
        nullable=False,
        server_default=text("ARRAY[]::uuid[]"),
    )
    assigned_managers: Mapped[list[uuid.UUID]] = mapped_column(
        ARRAY(UUID(as_uuid=True)),
        nullable=False,
        server_default=text("ARRAY[]::uuid[]"),
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="SET NULL"),
        nullable=True,
    )
    # Who last assigned people to this task (may differ from creator).
    assigned_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    task_mode: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default=text("'standard'")
    )
    priority: Mapped[str] = mapped_column(
        String(10), nullable=False, server_default=text("'Medium'")
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=text("'Not Started'"), index=True
    )

    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)

    requires_review: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )

    is_billable: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    billable_amount: Mapped[float | None] = mapped_column(
        Numeric(12, 2), nullable=True
    )
    billed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    checklist: Mapped[list[dict]] = mapped_column(
        JSONB, nullable=False, server_default=text("'[]'::jsonb")
    )
    sub_tasks: Mapped[list[dict]] = mapped_column(
        JSONB, nullable=False, server_default=text("'[]'::jsonb")
    )
    timeline: Mapped[list[dict]] = mapped_column(
        JSONB, nullable=False, server_default=text("'[]'::jsonb")
    )
    recurring_config: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    flagged: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false"), index=True
    )

    # Owner/Manager can close Updates thread when work is done (saves chat storage).
    updates_closed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false"), index=True
    )
    updates_closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updates_closed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="SET NULL"),
        nullable=True,
    )

    chats: Mapped[list["TaskChat"]] = relationship(
        back_populates="task",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="TaskChat.created_at",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Task {self.title!r} status={self.status}>"


class TaskChat(UUIDPKMixin, Base):
    __tablename__ = "task_chats"

    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sender_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    type: Mapped[str] = mapped_column(
        String(10), nullable=False, server_default=text("'text'")
    )
    voice_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    duration: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

    task: Mapped[Task] = relationship(back_populates="chats")
