"""Performance tracker."""

from __future__ import annotations

import uuid
from calendar import month_abbr
from datetime import date

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
from app.schemas.performance import MonthPoint, PerformanceCard, TeamPerformanceOverview

router = APIRouter(prefix="/performance", tags=["performance"])


def _require_access(user: Profile, *, target_user_id: uuid.UUID | None = None) -> None:
    role = Role(user.role)
    if role in {Role.OWNER, Role.MANAGER, Role.HR}:
        return
    if role in {Role.TEAM, Role.DEVELOPER} and (target_user_id is None or target_user_id == user.id):
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Performance restricted")


def _tier(completion_rate: float) -> str:
    """Performance tier per requirements doc section 4.6.

    80%+ Excellent, 60-79% Good, 40-59% Average, <40% Needs Support.
    """
    if completion_rate >= 80:
        return "Excellent"
    if completion_rate >= 60:
        return "Good"
    if completion_rate >= 40:
        return "Average"
    return "Needs Support"


def _period_start(period: str) -> date:
    today = date.today()
    key = (period or "monthly").lower()
    if key == "quarterly":
        month = ((today.month - 1) // 3) * 3 + 1
        return date(today.year, month, 1)
    if key == "yearly":
        return date(today.year, 1, 1)
    return date(today.year, today.month, 1)


def _as_date(value) -> date | None:
    if value is None:
        return None
    return value.date() if hasattr(value, "date") else value


def _month_buckets(count: int = 6) -> list[tuple[int, int]]:
    today = date.today()
    y, m = today.year, today.month
    buckets: list[tuple[int, int]] = []
    for _ in range(count):
        buckets.append((y, m))
        m -= 1
        if m == 0:
            m, y = 12, y - 1
    buckets.reverse()
    return buckets


def _month_points(tasks: list[Task], profile: Profile | None = None, months: int = 6) -> list[MonthPoint]:
    points: list[MonthPoint] = []
    for year, month in _month_buckets(months):
        seen: set[uuid.UUID] = set()
        for task in tasks:
            if profile is not None and profile.id not in (task.assigned_to or []):
                continue
            if task.status != "Completed":
                continue
            done_on = _as_date(task.updated_at) or _as_date(getattr(task, "created_at", None))
            if not done_on or done_on.year != year or done_on.month != month:
                continue
            if task.id in seen:
                continue
            seen.add(task.id)
        points.append(MonthPoint(label=month_abbr[month], value=len(seen)))
    return points


def _card(
    profile: Profile,
    tasks: list[Task],
    logs: list[AttendanceLog],
    leaves: list[LeaveRequest],
    since: date,
) -> PerformanceCard:
    assigned = [
        task
        for task in tasks
        if profile.id in (task.assigned_to or [])
        and (
            task.status not in {"Completed", "On Hold"}
            or (not task.created_at or task.created_at.date() >= since)
            or (task.due_date and task.due_date >= since)
            or (task.updated_at and task.updated_at.date() >= since)
        )
    ]
    completed = [task for task in assigned if task.status == "Completed"]
    overdue = [
        task
        for task in assigned
        if task.due_date and task.due_date < date.today() and task.status not in {"Completed", "On Hold"}
    ]
    struggling = [task for task in assigned if task.status in {"Struggling", "Needs Attention"} or task.flagged]
    completion_rate = round((len(completed) / len(assigned)) * 100, 2) if assigned else 0
    on_time = [task for task in completed if not task.due_date or task.updated_at.date() <= task.due_date]
    on_time_rate = round((len(on_time) / len(completed)) * 100, 2) if completed else 0
    user_logs = [log for log in logs if log.user_id == profile.id and log.date >= since and log.hours_worked]
    expected_days = max((date.today() - since).days, 1)
    attendance_rate = min(round((len(user_logs) / max(min(expected_days, 22), 1)) * 100, 2), 100)
    avg_hours = round(sum(float(log.hours_worked or 0) for log in user_logs) / len(user_logs), 1) if user_logs else 0
    taken = sum(l.days for l in leaves if l.user_id == profile.id and l.status == "Approved")
    return PerformanceCard(
        user_id=profile.id,
        name=profile.name,
        assigned=len(assigned),
        completed=len(completed),
        in_progress=sum(1 for task in assigned if task.status == "In Progress"),
        overdue=len(overdue),
        struggling=len(struggling),
        completion_rate=completion_rate,
        on_time_rate=on_time_rate,
        attendance_rate=attendance_rate,
        performance_tier=_tier(completion_rate),
        days_present=len(user_logs),
        avg_hours=avg_hours,
        leaves_taken=taken,
        monthly=_month_points(tasks, profile),
    )


@router.get("", response_model=TeamPerformanceOverview)
def performance_overview(
    user_id: uuid.UUID | None = Query(default=None),
    period: str = Query(default="monthly"),
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> TeamPerformanceOverview:
    role = Role(user.role)
    if role is Role.TEAM:
        user_id = user.id
    _require_access(user, target_user_id=user_id)
    since = _period_start(period)
    profiles_stmt = select(Profile).where(Profile.is_active.is_(True), Profile.role == Role.TEAM.value)
    if user_id:
        profiles_stmt = profiles_stmt.where(Profile.id == user_id)
    profiles = db.scalars(profiles_stmt.order_by(Profile.name)).all()
    tasks = db.scalars(select(Task)).all()
    logs = db.scalars(select(AttendanceLog).where(AttendanceLog.date >= since)).all()
    leaves = db.scalars(select(LeaveRequest)).all()
    cards = [_card(profile, tasks, logs, leaves, since) for profile in profiles]
    avg = round(sum(card.completion_rate for card in cards) / len(cards), 2) if cards else 0
    return TeamPerformanceOverview(
        team_size=len(cards),
        total_tasks=sum(card.assigned for card in cards),
        average_completion_rate=avg,
        total_overdue=sum(card.overdue for card in cards),
        members=cards,
        monthly_activity=_month_points(tasks),
    )
