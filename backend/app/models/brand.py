"""Brand records — long-term client knowledge base."""

from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, String, Text, text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampsMixin, UUIDPKMixin


class Brand(UUIDPKMixin, TimestampsMixin, Base):
    __tablename__ = "brands"

    name: Mapped[str] = mapped_column(String(160), nullable=False, unique=True)
    logo: Mapped[str | None] = mapped_column(String(8), nullable=True)
    logo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    client_type: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=text("'Retainer'")
    )
    priority: Mapped[str] = mapped_column(
        String(4), nullable=False, server_default=text("'P3'")
    )
    workflow_stage: Mapped[str] = mapped_column(
        String(32), nullable=False, server_default=text("'assigned'")
    )
    short_term_goals: Mapped[list[str]] = mapped_column(
        ARRAY(String), nullable=False, server_default=text("ARRAY[]::varchar[]")
    )
    long_term_goals: Mapped[list[str]] = mapped_column(
        ARRAY(String), nullable=False, server_default=text("ARRAY[]::varchar[]")
    )
    journey: Mapped[list[str]] = mapped_column(
        ARRAY(String), nullable=False, server_default=text("ARRAY[]::varchar[]")
    )
    responsibilities: Mapped[str | None] = mapped_column(Text, nullable=True)
    assigned_members: Mapped[list[uuid.UUID]] = mapped_column(
        ARRAY(UUID(as_uuid=True)),
        nullable=False,
        server_default=text("ARRAY[]::uuid[]"),
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="SET NULL"),
        nullable=True,
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Brand {self.name}>"
