"""Task Updates activity log + stakeholder notifications."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.models.brand import Brand
from app.models.notification import Notification
from app.models.profile import Profile
from app.models.task import Task, TaskChat


def _as_uuid(value: Any) -> uuid.UUID | None:
    if value is None:
        return None
    try:
        return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))
    except (TypeError, ValueError):
        return None


def task_stakeholder_ids(db: Session, task: Task) -> set[uuid.UUID]:
    """Everyone who should see task Updates and activity alerts."""
    recipients: set[uuid.UUID] = set()
    for raw in (*(task.assigned_to or []), *(task.assigned_managers or [])):
        uid = _as_uuid(raw)
        if uid:
            recipients.add(uid)
    for raw in (task.created_by, task.assigned_by):
        uid = _as_uuid(raw)
        if uid:
            recipients.add(uid)
    for sub in task.sub_tasks or []:
        for raw in sub.get("assigned_to") or []:
            uid = _as_uuid(raw)
            if uid:
                recipients.add(uid)
    if task.brand_id:
        brand = db.get(Brand, task.brand_id)
        if brand:
            for raw in (*(brand.assigned_members or []), *(getattr(brand, "assigned_managers", None) or [])):
                uid = _as_uuid(raw)
                if uid:
                    recipients.add(uid)
    return recipients


def notify_task_stakeholders(
    db: Session,
    task: Task,
    actor: Profile,
    message: str,
    *,
    notif_type: str = "chat",
    link: str | None = None,
    exclude_user_id: uuid.UUID | None = None,
) -> int:
    """Create in-app notifications for all task stakeholders."""
    recipients = task_stakeholder_ids(db, task)
    if exclude_user_id:
        recipients.discard(exclude_user_id)
    href = link or f"/updates?task={task.id}"
    preview = (message or "").strip()
    if len(preview) > 120:
        preview = preview[:117] + "…"
    count = 0
    for recipient in recipients:
        db.add(
            Notification(
                user_id=recipient,
                message=preview,
                type=notif_type,
                link=href,
            )
        )
        count += 1
    return count


def log_task_activity(
    db: Session,
    task: Task,
    actor: Profile,
    message: str,
    *,
    notify: bool = True,
    notif_type: str = "chat",
    chat_type: str = "system",
    link: str | None = None,
) -> TaskChat:
    """Append a system line to the per-task Updates thread and notify stakeholders."""
    text = (message or "").strip()
    chat = TaskChat(task_id=task.id, sender_id=actor.id, message=text, type=chat_type)
    db.add(chat)
    if notify and text and not getattr(task, "updates_closed", False):
        notif_msg = f'{actor.name} · "{task.title}": {text}'
        notify_task_stakeholders(
            db,
            task,
            actor,
            notif_msg,
            notif_type=notif_type,
            link=link or f"/updates?task={task.id}",
            exclude_user_id=actor.id,
        )
    return chat


def describe_task_update(update: dict[str, Any]) -> str | None:
    """Human-readable one-liner for a task PATCH."""
    if "status" in update:
        return f"Status changed to {update['status']}"
    parts: list[str] = []
    if "checklist" in update:
        parts.append("updated checklist")
    if "sub_tasks" in update:
        parts.append("updated sub-tasks")
    if "description" in update:
        parts.append("updated description")
    if "assigned_to" in update:
        parts.append("changed assignees")
    if "due_date" in update:
        parts.append(f"due date → {update['due_date']}")
    if "priority" in update:
        parts.append(f"priority → {update['priority']}")
    if "external_links" in update:
        parts.append("updated Drive links")
    if not parts:
        return None
    return "Task " + ", ".join(parts)
