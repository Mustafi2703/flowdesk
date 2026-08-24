"""Backfill NULL manager_ids on legacy profiles.

Revision ID: 0013_backfill_manager_ids
Revises: 0012_google_drive_integration
"""

from __future__ import annotations

from alembic import op

revision = "0013_backfill_manager_ids"
down_revision = "0012_google_drive_integration"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("UPDATE profiles SET manager_ids = ARRAY[]::uuid[] WHERE manager_ids IS NULL")


def downgrade() -> None:
    pass
