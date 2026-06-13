"""Personal / team calendar — tasks, leave, attendance by day."""

from __future__ import annotations

import calendar as cal
import uuid
from datetime import date, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.core.roles import Role
from app.db.session import get_db
from app.models.attendance import AttendanceLog
from app.models.leave import LeaveRequest
from app.models.profile import Profile
from app.models.task import Task

router = APIRouter(prefix="/calendar", tags=["calendar"])

_MANAGEMENT = {Role.OWNER, Role.MANAGER, Role.HR}


def _can_view_calendar(viewer: Profile, subject: Profile) -> bool:
    if viewer.id == subject.id:
        return True
    role = Role(viewer.role)
    if role is Role.OWNER or role is Role.HR:
        return True
    if role is Role.MANAGER and subject.manager_id == viewer.id:
        return True
    return False


def _resolve_subject(
    db: Session, viewer: Profile, user_id: uuid.UUID | None
) -> Profile:
    if user_id is None or user_id == viewer.id:
        return viewer
    subject = db.get(Profile, user_id)
    if not subject:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if not _can_view_calendar(viewer, subject):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    return subject


@router.get("")
def calendar(
    month: str = Query(..., pattern=r"^\d{4}-\d{2}$", description="YYYY-MM"),
    user_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    viewer: Profile = Depends(get_current_user),
) -> dict[str, Any]:
    """Month view for one employee. Managers can pass user_id for direct reports."""
    subject = _resolve_subject(db, viewer, user_id)
    year, mon = int(month[:4]), int(month[5:7])
    first = date(year, mon, 1)
    last = date(year, mon, cal.monthrange(year, mon)[1])

    tasks = db.scalars(
        select(Task).where(
            Task.assigned_to.any(subject.id),
            Task.due_date.is_not(None),
            Task.due_date >= first,
            Task.due_date <= last,
        )
    ).all()

    leaves = db.scalars(
        select(LeaveRequest).where(
            LeaveRequest.user_id == subject.id,
            LeaveRequest.start_date <= last,
            LeaveRequest.end_date >= first,
        )
    ).all()

    attendance = db.scalars(
        select(AttendanceLog).where(
            AttendanceLog.user_id == subject.id,
            AttendanceLog.date >= first,
            AttendanceLog.date <= last,
        )
    ).all()

    days: dict[str, dict[str, Any]] = {}
    d = first
    while d <= last:
        key = d.isoformat()
        day_tasks = [
            {
                "id": str(t.id),
                "title": t.title,
                "status": t.status,
                "priority": t.priority,
                "due_date": t.due_date.isoformat() if t.due_date else None,
            }
            for t in tasks
            if t.due_date == d
        ]
        day_leave = [
            {
                "id": str(lv.id),
                "leave_type": lv.leave_type,
                "status": lv.status,
                "days": lv.days,
            }
            for lv in leaves
            if lv.start_date <= d <= lv.end_date
        ]
        att = next((a for a in attendance if a.date == d), None)
        days[key] = {
            "tasks": day_tasks,
            "leave": day_leave,
            "attendance": (
                {
                    "clocked_in": bool(att and att.login_time and not att.logout_time),
                    "hours_worked": float(att.hours_worked) if att and att.hours_worked else None,
                }
                if att
                else None
            ),
        }
        d += timedelta(days=1)

    # Who can the viewer switch between (for manager dropdown)
    viewable_users: list[dict[str, str]] = [{"id": str(viewer.id), "name": viewer.name}]
    role = Role(viewer.role)
    if role in _MANAGEMENT:
        if role is Role.MANAGER:
            reports = db.scalars(
                select(Profile).where(Profile.manager_id == viewer.id, Profile.is_active.is_(True))
            ).all()
            viewable_users.extend({"id": str(r.id), "name": r.name} for r in reports)
        elif role in {Role.OWNER, Role.HR}:
            everyone = db.scalars(
                select(Profile).where(Profile.is_active.is_(True)).order_by(Profile.name)
            ).all()
            viewable_users = [{"id": str(p.id), "name": p.name} for p in everyone]

    return {
        "month": month,
        "user": {"id": str(subject.id), "name": subject.name, "role": subject.role},
        "days": days,
        "viewable_users": viewable_users,
    }
