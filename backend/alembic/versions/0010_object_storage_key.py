"""Add object-storage key for R2/S3 document buckets.

Revision ID: 0010_object_storage_key
Revises: 0009_brand_assigned_managers
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0010_object_storage_key"
down_revision = "0009_brand_assigned_managers"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "file_attachments",
        sa.Column("storage_key", sa.String(length=700), nullable=True),
    )
    op.add_column(
        "file_attachments",
        sa.Column(
            "storage_backend",
            sa.String(length=20),
            nullable=False,
            server_default="db",
        ),
    )
    op.create_index("ix_file_attachments_storage_key", "file_attachments", ["storage_key"])


def downgrade() -> None:
    op.drop_index("ix_file_attachments_storage_key", table_name="file_attachments")
    op.drop_column("file_attachments", "storage_backend")
    op.drop_column("file_attachments", "storage_key")
