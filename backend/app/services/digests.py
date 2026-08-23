"""Morning and evening digests — priority task briefs and end-of-day wrap-ups."""

from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.profile import Profile
from app.models.task import Task
from app.services.email import send_email

_PENDING = {
    "Not Started",
    "In Progress",
    "Under Review",
    "Revision Needed",
    "On Hold",
    "Struggling",
    "Needs Attention",
}
_PRIORITY_ORDER = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}


def _user_tasks(tasks: list[Task], user: Profile) -> list[Task]:
    if user.role in {"owner", "manager", "hr"}:
        return tasks
    return [task for task in tasks if user.id in (task.assigned_to or [])]


def _sort_priority(tasks: list[Task]) -> list[Task]:
    return sorted(
        tasks,
        key=lambda t: (
            _PRIORITY_ORDER.get(t.priority or "Medium", 9),
            t.due_date or date.max,
            t.title or "",
        ),
    )


def _li(task: Task) -> str:
    due = f" · due {task.due_date:%d %b}" if task.due_date else ""
    pri = task.priority or "Medium"
    return f"<li><strong>[{pri}]</strong> {task.title} — {task.status}{due}</li>"


def _base_lists(tasks: list[Task], today: date) -> dict[str, list[Task]]:
    pending = _sort_priority([t for t in tasks if t.status in _PENDING])
    overdue = [t for t in pending if t.due_date and t.due_date < today]
    due_today = [t for t in pending if t.due_date and t.due_date == today]
    due_soon = [
        t
        for t in pending
        if t.due_date and today < t.due_date <= today + timedelta(days=7)
    ]
    critical = [t for t in pending if (t.priority or "") in {"Critical", "High"}]
    under_review = [t for t in pending if t.status == "Under Review"]
    revision = [t for t in pending if t.status == "Revision Needed"]
    struggling = [t for t in pending if t.status in {"Struggling", "Needs Attention"}]
    completed_today = [
        t
        for t in tasks
        if t.status == "Completed"
        and t.updated_at
        and t.updated_at.date() == today
    ]
    return {
        "pending": pending,
        "overdue": overdue,
        "due_today": due_today,
        "due_soon": due_soon,
        "critical": critical,
        "under_review": under_review,
        "revision": revision,
        "struggling": struggling,
        "completed_today": completed_today,
    }


def _try_lock(db: Session, key: int) -> bool:
    return bool(db.execute(text("SELECT pg_try_advisory_lock(881122, :k)"), {"k": key}).scalar())


def send_morning_digests(db: Session, *, force: bool = False) -> int:
    """Morning brief: what to do today, ordered by priority."""
    today = date.today()
    if not force and not _try_lock(db, int(today.strftime("%Y%m%d") + "1")):
        return 0

    users = db.scalars(select(Profile).where(Profile.is_active.is_(True))).all()
    tasks = db.scalars(select(Task)).all()
    sent = 0
    for user in users:
        visible = _user_tasks(tasks, user)
        bags = _base_lists(visible, today)
        html = f"""
        <div style="font-family:system-ui,-apple-system,sans-serif;max-width:640px;margin:0 auto;color:#0f172a">
          <h2 style="margin:0 0 8px">Good morning, {user.name}</h2>
          <p style="color:#475569;margin:0 0 20px">Your Scrumfolks TMS plan for {today:%A, %d %B %Y}.</p>
          <h3 style="color:#c2410c">Priority focus ({len(bags['critical'])})</h3>
          <ul>{''.join(_li(t) for t in bags['critical'][:20]) or '<li>None — clear the day ahead</li>'}</ul>
          <h3>Due today ({len(bags['due_today'])})</h3>
          <ul>{''.join(_li(t) for t in bags['due_today'][:20]) or '<li>None</li>'}</ul>
          <h3 style="color:#b91c1c">Overdue ({len(bags['overdue'])})</h3>
          <ul>{''.join(_li(t) for t in bags['overdue'][:20]) or '<li>None</li>'}</ul>
          <h3>All open ({len(bags['pending'])})</h3>
          <ul>{''.join(_li(t) for t in bags['pending'][:30]) or '<li>None</li>'}</ul>
          <p style="margin-top:24px"><a href="{settings.app_base_url}" style="color:#ea580c;font-weight:600">Open Dashboard →</a></p>
        </div>
        """
        send_email(
            to=user.email,
            subject=f"Morning brief · {len(bags['critical'])} priority · {len(bags['due_today'])} due today · {today:%d %b}",
            html=html,
        )
        sent += 1
    return sent


def send_evening_digests(db: Session, *, force: bool = False) -> int:
    """Evening wrap-up: pending work + how the day went."""
    today = date.today()
    if not force and not _try_lock(db, int(today.strftime("%Y%m%d") + "2")):
        return 0

    users = db.scalars(select(Profile).where(Profile.is_active.is_(True))).all()
    tasks = db.scalars(select(Task)).all()
    sent = 0
    for user in users:
        visible = _user_tasks(tasks, user)
        bags = _base_lists(visible, today)
        done = bags["completed_today"]
        html = f"""
        <div style="font-family:system-ui,-apple-system,sans-serif;max-width:640px;margin:0 auto;color:#0f172a">
          <h2 style="margin:0 0 8px">Good evening, {user.name}</h2>
          <p style="color:#475569;margin:0 0 20px">Your Scrumfolks TMS wrap-up for {today:%A, %d %B %Y}.</p>
          <h3 style="color:#059669">Completed today ({len(done)})</h3>
          <ul>{''.join(_li(t) for t in done[:20]) or '<li>None marked completed today</li>'}</ul>
          <h3 style="color:#c2410c">Still open — priority ({len(bags['critical'])})</h3>
          <ul>{''.join(_li(t) for t in bags['critical'][:20]) or '<li>None</li>'}</ul>
          <h3>Pending overall ({len(bags['pending'])})</h3>
          <ul>{''.join(_li(t) for t in bags['pending'][:30]) or '<li>None</li>'}</ul>
          <h3>Upcoming (next 7 days) ({len(bags['due_soon'])})</h3>
          <ul>{''.join(_li(t) for t in bags['due_soon'][:20]) or '<li>Nothing due this week</li>'}</ul>
          <h3 style="color:#b91c1c">Overdue ({len(bags['overdue'])})</h3>
          <ul>{''.join(_li(t) for t in bags['overdue'][:15]) or '<li>None</li>'}</ul>
          <h3>Under review ({len(bags['under_review'])})</h3>
          <ul>{''.join(_li(t) for t in bags['under_review'][:15]) or '<li>None</li>'}</ul>
          <h3>Revision needed ({len(bags['revision'])})</h3>
          <ul>{''.join(_li(t) for t in bags['revision'][:15]) or '<li>None</li>'}</ul>
          <h3>Flagged ({len(bags['struggling'])})</h3>
          <ul>{''.join(_li(t) for t in bags['struggling'][:15]) or '<li>None</li>'}</ul>
          <p style="margin-top:24px"><a href="{settings.app_base_url}" style="color:#ea580c;font-weight:600">Open Dashboard →</a></p>
        </div>
        """
        send_email(
            to=user.email,
            subject=f"Evening brief · {len(done)} done · {len(bags['pending'])} pending · {today:%d %b}",
            html=html,
        )
        sent += 1
    return sent


def send_daily_digests(db: Session) -> int:
    """Backward-compatible alias used by cron — evening wrap-up."""
    return send_evening_digests(db)
