"""Wipe all application data (keeps schema). Use for a clean testing workspace.

Run once when RESET_WORKSPACE=true is set in the environment, or manually:

    python -m app.scripts.reset_workspace

After reset, docker-entrypoint runs bootstrap_admin to create the owner only.
"""

from __future__ import annotations

from sqlalchemy import text

from app.db.session import db_session


def reset_workspace() -> None:
    tables = [
        "task_chats",
        "tasks",
        "sop_documents",
        "notifications",
        "leave_requests",
        "daily_summaries",
        "brands",
        "attendance_logs",
        "announcements",
        "file_attachments",
        "profiles",
    ]
    with db_session() as db:
        joined = ", ".join(f'"{t}"' for t in tables)
        db.execute(text(f"TRUNCATE {joined} RESTART IDENTITY CASCADE"))
    print("[reset] workspace cleared — ready for bootstrap owner only")  # noqa: T201


if __name__ == "__main__":
    reset_workspace()
