"""Task assigned_by + close Updates channel for completed work.

Revision ID: 0008_assigned_by_updates_closed
Revises: 0007_updates_md_gaps
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0008_assigned_by_updates_closed"
down_revision = "0007_updates_md_gaps"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tasks",
        sa.Column("assigned_by", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_tasks_assigned_by",
        "tasks",
        "profiles",
        ["assigned_by"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_tasks_assigned_by", "tasks", ["assigned_by"])

    op.add_column(
        "tasks",
        sa.Column("updates_closed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.create_index("ix_tasks_updates_closed", "tasks", ["updates_closed"])
    op.add_column(
        "tasks",
        sa.Column("updates_closed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "tasks",
        sa.Column("updates_closed_by", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_tasks_updates_closed_by",
        "tasks",
        "profiles",
        ["updates_closed_by"],
        ["id"],
        ondelete="SET NULL",
    )
    op.execute(sa.text("UPDATE tasks SET assigned_by = created_by WHERE assigned_by IS NULL AND created_by IS NOT NULL"))


def downgrade() -> None:
    op.drop_constraint("fk_tasks_updates_closed_by", "tasks", type_="foreignkey")
    op.drop_column("tasks", "updates_closed_by")
    op.drop_column("tasks", "updates_closed_at")
    op.drop_index("ix_tasks_updates_closed", table_name="tasks")
    op.drop_column("tasks", "updates_closed")
    op.drop_index("ix_tasks_assigned_by", table_name="tasks")
    op.drop_constraint("fk_tasks_assigned_by", "tasks", type_="foreignkey")
    op.drop_column("tasks", "assigned_by")
