"""Add brand journey milestones array.

Revision ID: 0004_brand_journey
Revises: 0003_departments
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0004_brand_journey"
down_revision = "0003_departments"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "brands",
        sa.Column(
            "journey",
            postgresql.ARRAY(sa.String()),
            nullable=False,
            server_default=sa.text("ARRAY[]::varchar[]"),
        ),
    )


def downgrade() -> None:
    op.drop_column("brands", "journey")
