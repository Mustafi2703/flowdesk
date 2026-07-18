"""Brand logo URL, workflow stage, and DB-backed attachment bytes.

Revision ID: 0006_logo_workflow_files
Revises: 0005_core_departments
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0006_logo_workflow_files"
down_revision = "0005_core_departments"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("brands", sa.Column("logo_url", sa.Text(), nullable=True))
    op.add_column(
        "brands",
        sa.Column(
            "workflow_stage",
            sa.String(length=32),
            nullable=False,
            server_default="assigned",
        ),
    )
    op.add_column(
        "file_attachments",
        sa.Column("file_data", postgresql.BYTEA(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("file_attachments", "file_data")
    op.drop_column("brands", "workflow_stage")
    op.drop_column("brands", "logo_url")
