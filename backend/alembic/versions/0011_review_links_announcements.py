"""Review versions, Drive links, announcement date/image/link.

Revision ID: 0011_review_links_announcements
Revises: 0010_object_storage_key
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0011_review_links_announcements"
down_revision = "0010_object_storage_key"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tasks",
        sa.Column(
            "external_links",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )
    op.add_column(
        "tasks",
        sa.Column("review_status", sa.String(length=20), nullable=False, server_default="none"),
    )
    op.add_column(
        "tasks",
        sa.Column("review_version", sa.String(length=16), nullable=False, server_default="1"),
    )
    op.add_column(
        "tasks",
        sa.Column(
            "review_history",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )
    op.add_column(
        "file_attachments",
        sa.Column("review_version", sa.String(length=16), nullable=True),
    )
    op.add_column(
        "file_attachments",
        sa.Column(
            "review_history",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )
    op.add_column("announcements", sa.Column("event_date", sa.Date(), nullable=True))
    op.add_column("announcements", sa.Column("image_url", sa.Text(), nullable=True))
    op.add_column("announcements", sa.Column("link_url", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("announcements", "link_url")
    op.drop_column("announcements", "image_url")
    op.drop_column("announcements", "event_date")
    op.drop_column("file_attachments", "review_history")
    op.drop_column("file_attachments", "review_version")
    op.drop_column("tasks", "review_history")
    op.drop_column("tasks", "review_version")
    op.drop_column("tasks", "review_status")
    op.drop_column("tasks", "external_links")
