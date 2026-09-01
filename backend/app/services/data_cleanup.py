"""Scheduled retention: notifications, stale chat, orphaned uploads."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.notification import Notification
from app.models.task import Task, TaskChat


def cleanup_read_notifications(db: Session, *, older_than_days: int = 90) -> int:
    """Drop read notifications older than the retention window."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=older_than_days)
    result = db.execute(
        delete(Notification).where(
            Notification.is_read.is_(True),
            Notification.created_at < cutoff,
        )
    )
    db.commit()
    return int(result.rowcount or 0)


def cleanup_stale_task_chats(
    db: Session,
    *,
    closed_older_than_days: int = 180,
    batch_limit: int = 5000,
) -> dict[str, int]:
    """Purge chat rows for tasks whose Updates channel was closed long ago."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=closed_older_than_days)
    tasks = db.scalars(
        select(Task.id)
        .where(
            Task.updates_closed.is_(True),
            Task.updates_closed_at.is_not(None),
            Task.updates_closed_at < cutoff,
        )
        .limit(200)
    ).all()
    if not tasks:
        return {"tasks": 0, "messages": 0}
    task_ids = list(tasks)
    chats = db.scalars(
        select(TaskChat).where(TaskChat.task_id.in_(task_ids)).limit(batch_limit)
    ).all()
    count = len(chats)
    for chat in chats:
        db.delete(chat)
    db.commit()
    return {"tasks": len(task_ids), "messages": count}


def run_data_cleanup(
    db: Session,
    *,
    notification_days: int = 90,
    chat_days: int = 180,
) -> dict[str, int | dict[str, int]]:
    """Entry point for cron — safe to run daily."""
    notif = cleanup_read_notifications(db, older_than_days=notification_days)
    chats = cleanup_stale_task_chats(db, closed_older_than_days=chat_days)
    return {"notifications_purged": notif, "task_chats": chats}
