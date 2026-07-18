"""Performance tracker."""

from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.core.roles import Role
from app.db.session import get_db
from app.models.attendance import AttendanceLog
from app.models.profile import Profile
from app.models.task import Task
from app.schemas.performance import PerformanceCard, TeamPerformanceOverview

router = APIRouter(prefix="/performance", tags=["performance"])


def _require_access(user: Profile, *, target_user_id: uuid.UUID | None = None) -> None:
    role = Role(user.role)
    if role in {Role.OWNER, Role.MANAGER, Role.HR}:
        return
    if role is Role.TEAM and (target_user_id is None or target_user_id == user.id):
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


def _card(profile: Profile, tasks: list[Task], logs: list[AttendanceLog]) -> PerformanceCard:
    assigned = [task for task in tasks if profile.id in task.assigned_to]
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
    user_logs = [log for log in logs if log.user_id == profile.id and log.hours_worked]
    attendance_rate = min(round((len(user_logs) / 22) * 100, 2), 100)
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
    )


@router.get("", response_model=TeamPerformanceOverview)
def performance_overview(
    user_id: uuid.UUID | None = Query(default=None),
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> TeamPerformanceOverview:
    role = Role(user.role)
    if role is Role.TEAM:
        user_id = user.id
    _require_access(user, target_user_id=user_id)
    profiles_stmt = select(Profile).where(Profile.is_active.is_(True), Profile.role == Role.TEAM.value)
    if user_id:
        profiles_stmt = profiles_stmt.where(Profile.id == user_id)
    profiles = db.scalars(profiles_stmt.order_by(Profile.name)).all()
    tasks = db.scalars(select(Task)).all()
    logs = db.scalars(select(AttendanceLog)).all()
    cards = [_card(profile, tasks, logs) for profile in profiles]
    avg = round(sum(card.completion_rate for card in cards) / len(cards), 2) if cards else 0
    return TeamPerformanceOverview(
        team_size=len(cards),
        total_tasks=len(tasks),
        average_completion_rate=avg,
        total_overdue=sum(card.overdue for card in cards),
        members=cards,
    )
