"""Brand contact email + client meetings with Google Calendar."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0014_client_meetings"
down_revision = "0013_backfill_manager_ids"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("brands", sa.Column("contact_email", sa.String(180), nullable=True))
    op.create_table(
        "client_meetings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("brand_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("brands.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("client_email", sa.String(180), nullable=False),
        sa.Column("attendee_emails", postgresql.ARRAY(sa.String()), nullable=False, server_default=sa.text("ARRAY[]::varchar[]")),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False, server_default=sa.text("30")),
        sa.Column("recurrence", sa.String(20), nullable=False, server_default=sa.text("'none'")),
        sa.Column("recurrence_count", sa.Integer(), nullable=True),
        sa.Column("google_event_id", sa.String(256), nullable=True),
        sa.Column("google_meet_link", sa.Text(), nullable=True),
        sa.Column("google_calendar_link", sa.Text(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_client_meetings_brand_id", "client_meetings", ["brand_id"])
    op.create_index("ix_client_meetings_start_at", "client_meetings", ["start_at"])


def downgrade() -> None:
    op.drop_index("ix_client_meetings_start_at", table_name="client_meetings")
    op.drop_index("ix_client_meetings_brand_id", table_name="client_meetings")
    op.drop_table("client_meetings")
    op.drop_column("brands", "contact_email")
