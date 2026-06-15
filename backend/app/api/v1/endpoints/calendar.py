"""Personal / team / company calendar — role-scoped task and leave views."""

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

COMPANY_SCOPE = "company"


def _can_view_calendar(viewer: Profile, subject: Profile) -> bool:
    if viewer.id == subject.id:
        return True
    role = Role(viewer.role)
    if role is Role.OWNER:
        return True
    if role is Role.HR:
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


def _profile_lookup(db: Session) -> dict[uuid.UUID, Profile]:
    return {p.id: p for p in db.scalars(select(Profile)).all()}


def _build_personal_days(
    *,
    subject: Profile,
    tasks: list[Task],
    leaves: list[LeaveRequest],
    attendance: list[AttendanceLog],
    first: date,
    last: date,
) -> dict[str, dict[str, Any]]:
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
    return days


def _company_calendar(
    db: Session,
    viewer: Profile,
    month: str,
    first: date,
    last: date,
) -> dict[str, Any]:
    if Role(viewer.role) is not Role.OWNER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Owner only")

    profiles = _profile_lookup(db)
    tasks = db.scalars(
        select(Task).where(
            Task.due_date.is_not(None),
            Task.due_date >= first,
            Task.due_date <= last,
        )
    ).all()
    leaves = db.scalars(
        select(LeaveRequest).where(
            LeaveRequest.start_date <= last,
            LeaveRequest.end_date >= first,
        )
    ).all()
    attendance = db.scalars(
        select(AttendanceLog).where(
            AttendanceLog.date >= first,
            AttendanceLog.date <= last,
        )
    ).all()

    days: dict[str, dict[str, Any]] = {}
    d = first
    while d <= last:
        key = d.isoformat()
        day_tasks = []
        for t in tasks:
            if t.due_date != d:
                continue
            assignees = [
                profiles[uid].name
                for uid in t.assigned_to
                if uid in profiles
            ]
            day_tasks.append(
                {
                    "id": str(t.id),
                    "title": t.title,
                    "status": t.status,
                    "priority": t.priority,
                    "due_date": t.due_date.isoformat(),
                    "assignees": assignees,
                }
            )
        day_leave = [
            {
                "id": str(lv.id),
                "leave_type": lv.leave_type,
                "status": lv.status,
                "user_name": profiles[lv.user_id].name if lv.user_id in profiles else "Unknown",
            }
            for lv in leaves
            if lv.start_date <= d <= lv.end_date
        ]
        day_attendance = [a for a in attendance if a.date == d]
        days[key] = {
            "tasks": day_tasks,
            "leave": day_leave,
            "attendance": {
                "present_count": len(day_attendance),
                "clocked_in_count": sum(
                    1 for a in day_attendance if a.login_time and not a.logout_time
                ),
            },
        }
        d += timedelta(days=1)

    everyone = db.scalars(
        select(Profile).where(Profile.is_active.is_(True)).order_by(Profile.name)
    ).all()
    viewable_users = [{"id": COMPANY_SCOPE, "name": "Company Overview"}] + [
        {"id": str(p.id), "name": p.name} for p in everyone
    ]

    return {
        "month": month,
        "scope": "company",
        "user": {"id": COMPANY_SCOPE, "name": "Company Overview", "role": "owner"},
        "days": days,
        "viewable_users": viewable_users,
    }


@router.get("")
def calendar(
    month: str = Query(..., pattern=r"^\d{4}-\d{2}$", description="YYYY-MM"),
    user_id: uuid.UUID | None = None,
    scope: str = Query("personal", pattern="^(personal|company)$"),
    db: Session = Depends(get_db),
    viewer: Profile = Depends(get_current_user),
) -> dict[str, Any]:
    """Role-scoped calendar.

    - Owner: company overview (`scope=company`) or any employee calendar.
    - Manager: own calendar + direct reports.
    - HR: any employee calendar (attendance / leave cross-reference).
    - Everyone else: own assigned tasks only (+ own leave/attendance).
    """
    year, mon = int(month[:4]), int(month[5:7])
    first = date(year, mon, 1)
    last = date(year, mon, cal.monthrange(year, mon)[1])

    if scope == "company":
        return _company_calendar(db, viewer, month, first, last)

    subject = _resolve_subject(db, viewer, user_id)

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

    days = _build_personal_days(
        subject=subject,
        tasks=tasks,
        leaves=leaves,
        attendance=attendance,
        first=first,
        last=last,
    )

    role = Role(viewer.role)
    viewable_users: list[dict[str, str]] = [{"id": str(viewer.id), "name": viewer.name}]

    if role is Role.OWNER:
        everyone = db.scalars(
            select(Profile).where(Profile.is_active.is_(True)).order_by(Profile.name)
        ).all()
        viewable_users = [{"id": COMPANY_SCOPE, "name": "Company Overview"}] + [
            {"id": str(p.id), "name": p.name} for p in everyone
        ]
    elif role is Role.MANAGER:
        reports = db.scalars(
            select(Profile).where(Profile.manager_id == viewer.id, Profile.is_active.is_(True))
        ).all()
        viewable_users = [{"id": str(viewer.id), "name": viewer.name}] + [
            {"id": str(r.id), "name": r.name} for r in reports
        ]
    elif role is Role.HR:
        everyone = db.scalars(
            select(Profile).where(Profile.is_active.is_(True)).order_by(Profile.name)
        ).all()
        viewable_users = [{"id": str(p.id), "name": p.name} for p in everyone]

    return {
        "month": month,
        "scope": "personal",
        "user": {"id": str(subject.id), "name": subject.name, "role": subject.role},
        "days": days,
        "viewable_users": viewable_users,
    }
