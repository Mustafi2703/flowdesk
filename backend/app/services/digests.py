"""Daily digest generation."""

from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.profile import Profile
from app.models.task import Task
from app.services.email import send_email


def _user_tasks(tasks: list[Task], user: Profile) -> list[Task]:
    if user.role in {"owner", "manager"}:
        return tasks
    return [task for task in tasks if user.id in task.assigned_to]


def send_daily_digests(db: Session) -> int:
    today = date.today()
    users = db.scalars(select(Profile).where(Profile.is_active.is_(True))).all()
    tasks = db.scalars(select(Task)).all()
    sent = 0
    for user in users:
        visible = _user_tasks(tasks, user)
        overdue = [task for task in visible if task.due_date and task.due_date < today and task.status != "completed"]
        due_today = [task for task in visible if task.due_date == today]
        in_progress = [task for task in visible if task.status == "in_progress"]
        html = f"""
        <h2>Good morning, {user.name}</h2>
        <p>Your Scrumfolks TMS brief for {today:%A, %d %B %Y}.</p>
        <h3>Overdue ({len(overdue)})</h3><ul>{''.join(f'<li>{t.title}</li>' for t in overdue)}</ul>
        <h3>Due Today ({len(due_today)})</h3><ul>{''.join(f'<li>{t.title}</li>' for t in due_today)}</ul>
        <h3>In Progress ({len(in_progress)})</h3><ul>{''.join(f'<li>{t.title}</li>' for t in in_progress)}</ul>
        <p><a href="{settings.app_base_url}">Open Dashboard</a></p>
        """
        send_email(to=user.email, subject="Your Scrumfolks TMS daily brief", html=html)
        sent += 1
    return sent
