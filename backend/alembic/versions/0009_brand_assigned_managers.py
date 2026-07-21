"""Brand assigned_managers for role-wise allocation.

Revision ID: 0009_brand_assigned_managers
Revises: 0008_assigned_by_updates_closed
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0009_brand_assigned_managers"
down_revision = "0008_assigned_by_updates_closed"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "brands",
        sa.Column(
            "assigned_managers",
            postgresql.ARRAY(postgresql.UUID(as_uuid=True)),
            nullable=False,
            server_default=sa.text("ARRAY[]::uuid[]"),
        ),
    )


def downgrade() -> None:
    op.drop_column("brands", "assigned_managers")
