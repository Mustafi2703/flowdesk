"""Brand identity fields, multi-manager, attachment review, hard-delete support.

Revision ID: 0007_updates_md_gaps
Revises: 0006_logo_workflow_files
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0007_updates_md_gaps"
down_revision = "0006_logo_workflow_files"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Brand identity / brand kit
    op.add_column("brands", sa.Column("fonts", sa.Text(), nullable=True))
    op.add_column(
        "brands",
        sa.Column(
            "logo_variants",
            postgresql.ARRAY(sa.String()),
            nullable=False,
            server_default=sa.text("ARRAY[]::varchar[]"),
        ),
    )
    op.add_column("brands", sa.Column("brand_colors", sa.Text(), nullable=True))
    op.add_column("brands", sa.Column("photography_style", sa.Text(), nullable=True))
    op.add_column("brands", sa.Column("brand_voice", sa.Text(), nullable=True))

    # Multi-manager reporting lines (primary manager_id kept in sync as first entry)
    op.add_column(
        "profiles",
        sa.Column(
            "manager_ids",
            postgresql.ARRAY(postgresql.UUID(as_uuid=True)),
            nullable=False,
            server_default=sa.text("ARRAY[]::uuid[]"),
        ),
    )
    op.execute(
        """
        UPDATE profiles
        SET manager_ids = ARRAY[manager_id]
        WHERE manager_id IS NOT NULL
          AND (manager_ids IS NULL OR cardinality(manager_ids) = 0)
        """
    )

    # Attachment review workflow
    op.add_column(
        "file_attachments",
        sa.Column(
            "review_status",
            sa.String(length=20),
            nullable=False,
            server_default="pending",
        ),
    )
    op.add_column(
        "file_attachments",
        sa.Column("reviewed_by", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "file_attachments",
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column("file_attachments", sa.Column("review_notes", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("file_attachments", "review_notes")
    op.drop_column("file_attachments", "reviewed_at")
    op.drop_column("file_attachments", "reviewed_by")
    op.drop_column("file_attachments", "review_status")
    op.drop_column("profiles", "manager_ids")
    op.drop_column("brands", "brand_voice")
    op.drop_column("brands", "photography_style")
    op.drop_column("brands", "brand_colors")
    op.drop_column("brands", "logo_variants")
    op.drop_column("brands", "fonts")
