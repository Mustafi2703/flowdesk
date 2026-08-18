"""Daily digest generation — evening brief of pending work and upcoming dates."""

from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.profile import Profile
from app.models.task import Task
from app.services.email import send_email

_DONE = {"Completed"}
_PENDING = {
    "Not Started",
    "In Progress",
    "Under Review",
    "Revision Needed",
    "On Hold",
    "Struggling",
    "Needs Attention",
}


def _user_tasks(tasks: list[Task], user: Profile) -> list[Task]:
    if user.role in {"owner", "manager", "hr"}:
        return tasks
    return [task for task in tasks if user.id in (task.assigned_to or [])]


def _li(task: Task) -> str:
    due = f" · due {task.due_date:%d %b}" if task.due_date else ""
    return f"<li>{task.title} — {task.status}{due}</li>"


def send_daily_digests(db: Session) -> int:
    today = date.today()
    lock_key = int(today.strftime("%Y%m%d"))
    got = db.execute(text("SELECT pg_try_advisory_lock(881122, :k)"), {"k": lock_key}).scalar()
    if not got:
        return 0

    soon = today + timedelta(days=7)
    users = db.scalars(select(Profile).where(Profile.is_active.is_(True))).all()
    tasks = db.scalars(select(Task)).all()
    sent = 0
    for user in users:
        visible = _user_tasks(tasks, user)
        pending = [t for t in visible if t.status in _PENDING]
        overdue = [t for t in pending if t.due_date and t.due_date < today]
        due_soon = [t for t in pending if t.due_date and today <= t.due_date <= soon]
        under_review = [t for t in pending if t.status == "Under Review"]
        revision = [t for t in pending if t.status == "Revision Needed"]
        html = f"""
        <h2>Good evening, {user.name}</h2>
        <p>Your Scrumfolks TMS wrap-up for {today:%A, %d %B %Y}.</p>
        <h3>Pending tasks ({len(pending)})</h3>
        <ul>{''.join(_li(t) for t in pending[:40]) or '<li>None</li>'}</ul>
        <h3>Overdue ({len(overdue)})</h3>
        <ul>{''.join(_li(t) for t in overdue[:20]) or '<li>None</li>'}</ul>
        <h3>Upcoming this week ({len(due_soon)})</h3>
        <ul>{''.join(_li(t) for t in due_soon[:20]) or '<li>None</li>'}</ul>
        <h3>Under review ({len(under_review)})</h3>
        <ul>{''.join(_li(t) for t in under_review[:15]) or '<li>None</li>'}</ul>
        <h3>Revision needed ({len(revision)})</h3>
        <ul>{''.join(_li(t) for t in revision[:15]) or '<li>None</li>'}</ul>
        <p><a href="{settings.app_base_url}">Open Dashboard</a></p>
        """
        send_email(
            to=user.email,
            subject=f"Evening brief · {len(pending)} pending · {today:%d %b}",
            html=html,
        )
        sent += 1
    return sent
