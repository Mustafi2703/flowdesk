"""Spawn the next occurrence when a recurring task is completed."""

from __future__ import annotations

import calendar
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.models.task import Task


def advance_due_date(current: date, frequency: str) -> date:
    """Move a due date forward by the configured cadence."""
    freq = (frequency or "monthly").strip().lower()
    if freq == "daily":
        return current + timedelta(days=1)
    if freq == "weekly":
        return current + timedelta(weeks=1)
    if freq == "yearly":
        try:
            return current.replace(year=current.year + 1)
        except ValueError:
            # Feb 29 → Feb 28 next year
            return current.replace(year=current.year + 1, day=28)
    # monthly (default)
    year = current.year + (1 if current.month == 12 else 0)
    month = 1 if current.month == 12 else current.month + 1
    last = calendar.monthrange(year, month)[1]
    return date(year, month, min(current.day, last))


def is_recurring_enabled(task: Task) -> bool:
    cfg = task.recurring_config or {}
    return bool(cfg.get("enabled"))


def _next_due_for(task: Task) -> date:
    cfg = task.recurring_config or {}
    raw = cfg.get("next_due") or (task.due_date.isoformat() if task.due_date else None)
    if raw:
        try:
            return date.fromisoformat(str(raw)[:10])
        except ValueError:
            pass
    return task.due_date or date.today()


def spawn_next_occurrence(db: Session, task: Task) -> Task | None:
    """Clone a completed recurring task into the next open occurrence.

    Returns the new task, or None if the source is not a enabled recurring task.
    """
    if not is_recurring_enabled(task):
        return None
    cfg = dict(task.recurring_config or {})
    frequency = str(cfg.get("frequency") or "monthly")
    base = _next_due_for(task)
    next_due = advance_due_date(base, frequency)
    new_cfg: dict[str, Any] = {
        "enabled": True,
        "frequency": frequency,
        "next_due": next_due.isoformat(),
    }
    if cfg.get("day_of_month") is not None:
        new_cfg["day_of_month"] = cfg.get("day_of_month")

    clone = Task(
        title=task.title,
        description=task.description,
        brand_id=task.brand_id,
        assigned_to=list(task.assigned_to or []),
        assigned_managers=list(task.assigned_managers or []),
        created_by=task.created_by,
        assigned_by=task.assigned_by,
        type=task.type,
        task_mode=task.task_mode or "standard",
        priority=task.priority or "Medium",
        status="Not Started",
        start_date=date.today(),
        due_date=next_due,
        requires_review=bool(task.requires_review),
        is_billable=bool(task.is_billable),
        billable_amount=task.billable_amount if task.is_billable else None,
        checklist=[],
        sub_tasks=[],
        recurring_config=new_cfg,
        timeline=[
            {
                "by": str(task.created_by or task.id),
                "action": f"Recurring instance from {task.id} ({frequency})",
                "at": datetime.now(timezone.utc).isoformat(),
            }
        ],
        external_links=list(getattr(task, "external_links", None) or []),
    )
    db.add(clone)
    # Keep history on the completed task; disable further spawn from it.
    task.recurring_config = {
        **cfg,
        "enabled": False,
        "spawned_task_id": None,  # filled after flush
        "completed_cycle_at": datetime.now(timezone.utc).isoformat(),
        "frequency": frequency,
        "next_due": next_due.isoformat(),
    }
    flag_modified(task, "recurring_config")
    db.flush()
    cfg_done = dict(task.recurring_config or {})
    cfg_done["spawned_task_id"] = str(clone.id)
    task.recurring_config = cfg_done
    flag_modified(task, "recurring_config")
    return clone


def process_completed_recurring(db: Session, task: Task) -> Task | None:
    """Call after a task is marked Completed."""
    if task.status != "Completed":
        return None
    if not is_recurring_enabled(task):
        return None
    return spawn_next_occurrence(db, task)
