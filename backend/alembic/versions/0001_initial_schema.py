"""Initial Scrumfolks TMS schema.

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-05-22
"""

from __future__ import annotations

from alembic import op

from app.db.base import Base
from app import models  # noqa: F401 - register all models

revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')
    Base.metadata.create_all(bind)
    # Enable RLS with a permissive policy on every table.
    # Auth is enforced at the API layer (see app/api/v1/deps.py); the
    # permissive policy is defense-in-depth, matching section 9 of the spec.
    # We wrap each CREATE POLICY in a DO block so re-running the migration
    # against an existing database is safe.
    for table in (
        "profiles",
        "brands",
        "tasks",
        "task_chats",
        "file_attachments",
        "attendance_logs",
        "leave_requests",
        "announcements",
        "notifications",
        "daily_summaries",
        "sop_documents",
    ):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(
            f"""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_policies
                    WHERE schemaname = current_schema()
                      AND tablename = '{table}'
                      AND policyname = '{table}_app_policy'
                ) THEN
                    CREATE POLICY {table}_app_policy
                        ON {table} FOR ALL USING (true) WITH CHECK (true);
                END IF;
            END
            $$;
            """
        )


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind)
