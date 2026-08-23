"""Google Drive workspace integration credentials.

Revision ID: 0012_google_drive_integration
Revises: 0011_review_links_announcements
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0012_google_drive_integration"
down_revision = "0011_review_links_announcements"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "integrations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("provider", sa.String(length=40), nullable=False),
        sa.Column("account_email", sa.String(length=180), nullable=True),
        sa.Column("refresh_token_enc", sa.Text(), nullable=False),
        sa.Column("access_token_enc", sa.Text(), nullable=True),
        sa.Column("token_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("root_folder_id", sa.String(length=128), nullable=True),
        sa.Column("root_folder_url", sa.String(length=512), nullable=True),
        sa.Column(
            "connected_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("profiles.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("provider", name="uq_integrations_provider"),
    )
    op.create_index("ix_integrations_provider", "integrations", ["provider"])


def downgrade() -> None:
    op.drop_index("ix_integrations_provider", table_name="integrations")
    op.drop_table("integrations")
