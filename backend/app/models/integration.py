"""Third-party integrations (Google Drive, etc.)."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, text
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampsMixin, UUIDPKMixin


class Integration(UUIDPKMixin, TimestampsMixin, Base):
    __tablename__ = "integrations"

    provider: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    account_email: Mapped[str | None] = mapped_column(String(180), nullable=True)
    refresh_token_enc: Mapped[str] = mapped_column(Text, nullable=False)
    access_token_enc: Mapped[str | None] = mapped_column(Text, nullable=True)
    token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    root_folder_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    root_folder_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    connected_by: Mapped[uuid.UUID | None] = mapped_column(
        postgresql.UUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="SET NULL"),
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
