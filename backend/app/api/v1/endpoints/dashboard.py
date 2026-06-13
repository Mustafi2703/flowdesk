"""Role-aware personalized dashboard.

This is the only endpoint that uses our in-memory data structures
(heapq priority queue + deque ring + TTL cache). All other endpoints stay
straightforward CRUD — we only pay the indirection cost where it matters.

For each request:

1. Look up a per-user TTL cache snapshot — if hot, return immediately.
2. Otherwise pull the user's visible tasks/announcements/leaves/clock state
   from PostgreSQL (one query each).
3. Push each visible open task into a fresh PriorityHeap with an urgency
   score derived from (flagged_status, priority_weight, days_remaining).
4. Build the role-specific payload (stats, recent tasks, announcements,
   flagged tasks, pending leaves, clock state, personalized priority lane).
5. Mirror the most recent 10 notifications into the user's RingBuffer for
   later sub-second reads.
6. Memoize the payload in the TTLCache and return it.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.core.roles import Role
from app.db.session import get_db
from app.models.announcement import Announcement
from app.models.attendance import AttendanceLog
from app.models.leave import LeaveRequest
from app.models.notification import Notification
from app.models.profile import Profile
from app.models.task import Task
from app.utils.queues import (
    DASHBOARD_CACHE,
    PriorityHeap,
    notification_ring,
    urgency_score,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

_IST = timezone(timedelta(hours=5, minutes=30))
_OPEN_STATUSES = {"Not Started", "In Progress", "Under Review", "Revision Needed"}
_FLAGGED_STATUSES = {"Struggling", "Needs Attention"}


def _serialize_task(task: Task) -> dict[str, Any]:
    return {
        "id": str(task.id),
        "title": task.title,
        "status": task.status,
        "priority": task.priority,
        "type": task.type,
        "due_date": task.due_date.isoformat() if task.due_date else None,
        "is_billable": task.is_billable,
        "task_mode": task.task_mode,
        "brand_id": str(task.brand_id) if task.brand_id else None,
        "assigned_to": [str(uid) for uid in (task.assigned_to or [])],
    }


def _visible(task: Task, user: Profile) -> bool:
    if Role(user.role) in {Role.OWNER, Role.MANAGER, Role.HR, Role.ACCOUNTANT}:
        return True
    if user.id in (task.assigned_to or []):
        return True
    sub_ids = task.sub_tasks or []
    me = str(user.id)
    return any(me in {str(x) for x in (st.get("assigned_to") or [])} for st in sub_ids)


def _build_payload(db: Session, user: Profile) -> dict[str, Any]:
    today = date.today()
    role = Role(user.role)

    tasks_all = db.scalars(select(Task)).all()
    visible_tasks = [task for task in tasks_all if _visible(task, user)]
    announcements = db.scalars(
        select(Announcement).order_by(Announcement.created_at.desc()).limit(3)
    ).all()
    pending_leaves = (
        db.scalars(
            select(LeaveRequest)
            .where(LeaveRequest.status == "Pending")
            .order_by(LeaveRequest.created_at.desc())
            .limit(10)
        ).all()
        if role in {Role.OWNER, Role.MANAGER, Role.HR}
        else []
    )
    now = datetime.now(_IST)
    clock = db.scalar(
        select(AttendanceLog).where(AttendanceLog.user_id == user.id, AttendanceLog.date == now.date())
    )
    recent_notes = db.scalars(
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(10)
    ).all()

    # Build the personalized priority lane via heapq.
    heap: PriorityHeap[dict[str, Any]] = PriorityHeap()
    for task in visible_tasks:
        if task.status in _OPEN_STATUSES or task.status in _FLAGGED_STATUSES:
            heap.push(urgency_score(_serialize_task(task), today=today), _serialize_task(task))

    overdue = [
        task
        for task in visible_tasks
        if task.due_date and task.due_date < today and task.status != "Completed"
    ]
    completed = [task for task in visible_tasks if task.status == "Completed"]
    flagged = [task for task in visible_tasks if task.status in _FLAGGED_STATUSES]
    due_today = [task for task in visible_tasks if task.due_date == today]

    if role in {Role.OWNER, Role.MANAGER}:
        stats = {
            "total_tasks": len(visible_tasks),
            "completed_tasks": len(completed),
            "overdue_tasks": len(overdue),
            "flagged_tasks": len(flagged),
            "pending_leave_requests": len(pending_leaves),
        }
    elif role is Role.HR:
        stats = {
            "leave_pending": len(pending_leaves),
            "total_staff": db.scalar(
                select(func.count(Profile.id)).where(Profile.is_active.is_(True))
            )
            or 0,
        }
    elif role is Role.ACCOUNTANT:
        billable = [task for task in visible_tasks if task.is_billable]
        stats = {
            "billable_tasks": len(billable),
            "pending_billing": sum(1 for task in billable if task.billed_at is None),
        }
    else:
        my_tasks = [task for task in visible_tasks if user.id in (task.assigned_to or [])]
        stats = {
            "my_tasks": len(my_tasks),
            "completed": sum(1 for task in my_tasks if task.status == "Completed"),
            "due_today": sum(1 for task in my_tasks if task.due_date == today),
            "in_progress": sum(1 for task in my_tasks if task.status == "In Progress"),
        }

    # Refresh the user's notification ring buffer (deque).
    ring = notification_ring(str(user.id))
    for note in reversed(recent_notes):  # oldest first
        ring.push(
            {
                "id": str(note.id),
                "message": note.message,
                "type": note.type,
                "is_read": note.is_read,
                "created_at": note.created_at.isoformat(),
            }
        )

    payload: dict[str, Any] = {
        "user": {
            "id": str(user.id),
            "name": user.name,
            "email": user.email,
            "role": user.role,
        },
        "stats": stats,
        "priority_lane": heap.top_k(8),
        "recent_tasks": [_serialize_task(task) for task in sorted(visible_tasks, key=lambda x: x.updated_at, reverse=True)[:6]],
        "announcements": [
            {
                "id": str(a.id),
                "title": a.title,
                "body": a.body,
                "priority": a.priority,
                "created_at": a.created_at.isoformat(),
            }
            for a in announcements
        ],
        "flagged_tasks": [_serialize_task(task) for task in flagged[:5]],
        "due_today": [_serialize_task(task) for task in due_today[:5]],
        "pending_leave_requests": [
            {
                "id": str(leave.id),
                "user_id": str(leave.user_id),
                "leave_type": leave.leave_type,
                "days": leave.days,
                "start_date": leave.start_date.isoformat(),
                "end_date": leave.end_date.isoformat(),
            }
            for leave in pending_leaves
        ],
        "clock_state": {
            "clocked_in": bool(clock and clock.login_time and not clock.logout_time),
            "login_time": clock.login_time.isoformat() if clock and clock.login_time else None,
            "logout_time": clock.logout_time.isoformat() if clock and clock.logout_time else None,
            "hours_worked": float(clock.hours_worked) if clock and clock.hours_worked else None,
        },
        "notifications": ring.latest(10)[::-1],
    }
    return payload


@router.get("")
def dashboard(db: Session = Depends(get_db), user: Profile = Depends(get_current_user)) -> dict[str, Any]:
    cache_key = f"dash:{user.id}:{user.role}"
    cached = DASHBOARD_CACHE.get(cache_key)
    if cached is not None:
        return cached
    payload = _build_payload(db, user)
    DASHBOARD_CACHE.set(cache_key, payload)
    return payload


@router.post("/invalidate", include_in_schema=False)
def invalidate(user: Profile = Depends(get_current_user)) -> dict[str, bool]:
    """Force a fresh dashboard recompute on next read (used after mutations)."""
    DASHBOARD_CACHE.invalidate(f"dash:{user.id}:{user.role}")
    return {"ok": True}
