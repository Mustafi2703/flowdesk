"""Clear demo/sample content but keep login accounts (profiles).

    python -m app.scripts.clear_demo_data

Removes brands, tasks, chats, notifications, leaves, attendance,
announcements, attachments, and related demo rows so the workspace
is empty for real testing. Demo role logins stay intact.
"""

from __future__ import annotations

from sqlalchemy import text

from app.db.session import db_session


def clear_demo_data() -> None:
    # Keep profiles + departments so owner/manager/team/hr/accountant can still log in.
    tables = [
        "task_chats",
        "tasks",
        "notifications",
        "leave_requests",
        "daily_summaries",
        "brands",
        "attendance_logs",
        "announcements",
        "file_attachments",
        "sop_documents",
    ]
    with db_session() as db:
        existing = set(
            db.execute(
                text(
                    "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
                )
            ).scalars()
        )
        to_wipe = [t for t in tables if t in existing]
        if not to_wipe:
            print("[clear] nothing to wipe")  # noqa: T201
            return
        joined = ", ".join(f'"{t}"' for t in to_wipe)
        db.execute(text(f"TRUNCATE {joined} RESTART IDENTITY CASCADE"))
    print(f"[clear] wiped demo data: {', '.join(to_wipe)}")  # noqa: T201
    print("[clear] profiles kept — log in and create fresh brands/tasks")  # noqa: T201


if __name__ == "__main__":
    clear_demo_data()
