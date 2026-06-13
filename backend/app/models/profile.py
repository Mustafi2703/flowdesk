"""User profiles — the only user table in the system."""

from __future__ import annotations

from sqlalchemy import Boolean, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampsMixin, UUIDPKMixin


class Profile(UUIDPKMixin, TimestampsMixin, Base):
    __tablename__ = "profiles"

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(180), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    department: Mapped[str | None] = mapped_column(String(60), nullable=True)
    designation: Mapped[str | None] = mapped_column(String(120), nullable=True)
    avatar: Mapped[str | None] = mapped_column(String(8), nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )
    leaves_total: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("21"))
    leaves_taken: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Profile {self.name} role={self.role}>"
