"""Cross-task updates feed — Slack-style activity across tasks."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.api.v1.endpoints.tasks import _brand_map, _can_view
from app.core.roles import Role
from app.db.session import get_db
from app.models.profile import Profile
from app.models.task import Task, TaskChat

router = APIRouter(prefix="/updates", tags=["updates"])


@router.get("")
def list_updates(
    limit: int = Query(default=80, ge=1, le=200),
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """Return recent task chat messages the current user can see."""
    chats = db.scalars(select(TaskChat).order_by(TaskChat.created_at.desc()).limit(limit * 3)).all()
    if not chats:
        return []

    task_ids = {chat.task_id for chat in chats}
    tasks = {
        task.id: task
        for task in db.scalars(select(Task).where(Task.id.in_(task_ids))).all()
    }
    brands = _brand_map(db, [task.brand_id for task in tasks.values() if task.brand_id])
    sender_ids = {chat.sender_id for chat in chats}
    senders = {
        sender.id: sender
        for sender in db.scalars(select(Profile).where(Profile.id.in_(sender_ids))).all()
    }

    out: list[dict[str, Any]] = []
    for chat in chats:
        task = tasks.get(chat.task_id)
        brand = brands.get(task.brand_id) if task and task.brand_id else None
        if not task or not _can_view(task, user, brand):
            continue
        sender = senders.get(chat.sender_id)
        out.append(
            {
                "id": str(chat.id),
                "task_id": str(chat.task_id),
                "task_title": task.title,
                "task_status": task.status,
                "message": chat.message,
                "type": chat.type,
                "created_at": chat.created_at.isoformat(),
                "sender": (
                    {
                        "id": str(sender.id),
                        "name": sender.name,
                        "avatar": sender.avatar,
                        "role": sender.role,
                    }
                    if sender
                    else None
                ),
            }
        )
        if len(out) >= limit:
            break
    return out


@router.get("/tasks/{task_id}")
def list_task_thread(
    task_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """Convenience alias used by the Updates UI thread panel."""
    from app.api.v1.endpoints.tasks import _can_view_db

    task = db.get(Task, task_id)
    if not task or not _can_view_db(db, task, user):
        return []
    chats = db.scalars(
        select(TaskChat).where(TaskChat.task_id == task_id).order_by(TaskChat.created_at)
    ).all()
    sender_ids = {chat.sender_id for chat in chats}
    senders = {
        sender.id: sender
        for sender in db.scalars(select(Profile).where(Profile.id.in_(sender_ids))).all()
    }
    return [
        {
            "id": str(chat.id),
            "task_id": str(chat.task_id),
            "message": chat.message,
            "type": chat.type,
            "created_at": chat.created_at.isoformat(),
            "sender": (
                {
                    "id": str(sender.id),
                    "name": sender.name,
                    "avatar": sender.avatar,
                    "role": sender.role,
                }
                if (sender := senders.get(chat.sender_id))
                else None
            ),
        }
        for chat in chats
    ]
