"""Add manager_id for reporting hierarchy.

Revision ID: 0002_manager_hierarchy
Revises: 0001_initial_schema
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0002_manager_hierarchy"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "profiles",
        sa.Column("manager_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_profiles_manager_id",
        "profiles",
        "profiles",
        ["manager_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_profiles_manager_id", "profiles", ["manager_id"])


def downgrade() -> None:
    op.drop_index("ix_profiles_manager_id", table_name="profiles")
    op.drop_constraint("fk_profiles_manager_id", "profiles", type_="foreignkey")
    op.drop_column("profiles", "manager_id")
