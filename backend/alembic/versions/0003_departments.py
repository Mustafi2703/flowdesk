"""Add departments table for org structure and manager assignment.

Revision ID: 0003_departments
Revises: 0002_manager_hierarchy
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0003_departments"
down_revision = "0002_manager_hierarchy"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "departments",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("manager_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["profiles.id"], name="fk_departments_created_by", ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["manager_id"], ["profiles.id"], name="fk_departments_manager_id", ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_departments_name"),
    )
    op.create_index("ix_departments_manager_id", "departments", ["manager_id"])


def downgrade() -> None:
    op.drop_index("ix_departments_manager_id", table_name="departments")
    op.drop_table("departments")
