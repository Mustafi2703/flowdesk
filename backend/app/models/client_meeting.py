"""Client meetings — brand syncs with Google Calendar + Meet."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampsMixin, UUIDPKMixin


class ClientMeeting(UUIDPKMixin, TimestampsMixin, Base):
    __tablename__ = "client_meetings"

    brand_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("brands.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    client_email: Mapped[str] = mapped_column(String(180), nullable=False)
    attendee_emails: Mapped[list[str]] = mapped_column(
        ARRAY(String),
        nullable=False,
        server_default=text("ARRAY[]::varchar[]"),
    )
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("30"))
    recurrence: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'none'"))
    recurrence_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    google_event_id: Mapped[str | None] = mapped_column(String(256), nullable=True)
    google_meet_link: Mapped[str | None] = mapped_column(Text, nullable=True)
    google_calendar_link: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="SET NULL"),
        nullable=True,
    )
