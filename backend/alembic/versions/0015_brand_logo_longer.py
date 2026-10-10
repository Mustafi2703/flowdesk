"""Allow longer brand logo initials fallback."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0015_brand_logo_longer"
down_revision = "0014_client_meetings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "brands",
        "logo",
        existing_type=sa.String(length=8),
        type_=sa.String(length=32),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "brands",
        "logo",
        existing_type=sa.String(length=32),
        type_=sa.String(length=8),
        existing_nullable=True,
    )
