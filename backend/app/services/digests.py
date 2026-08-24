"""Morning and evening digests — priority task briefs and end-of-day wrap-ups."""

from __future__ import annotations

import html
from datetime import date, timedelta

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.profile import Profile
from app.models.task import Task
from app.services.email import send_email, test_recipient_list

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


def _priority_color(priority: str) -> str:
    return {
        "Critical": "#DC2626",
        "High": "#E8630A",
        "Medium": "#CA8A04",
        "Low": "#16A34A",
    }.get(priority or "", "#6B7280")


def _task_row(task: Task) -> str:
    due = f" · due {task.due_date:%d %b}" if task.due_date else ""
    pri = task.priority or "Medium"
    title = html.escape(task.title or "Untitled")
    status = html.escape(task.status or "—")
    return (
        "<tr>"
        f'<td style="padding:10px 12px;border-bottom:1px solid #F3F4F6;font-size:13px;">'
        f'<span style="color:{_priority_color(pri)};font-weight:700;">[{html.escape(pri)}]</span> '
        f"{title}"
        f"</td>"
        f'<td style="padding:10px 12px;border-bottom:1px solid #F3F4F6;font-size:12px;color:#6B7280;">{status}{due}</td>'
        "</tr>"
    )


def _section_table(title: str, tasks: list[Task], *, accent: str = "#1A1A2E", empty: str = "None") -> str:
    rows = "".join(_task_row(t) for t in tasks[:20])
    if not rows:
        rows = f'<tr><td colspan="2" style="padding:12px;color:#9CA3AF;font-size:13px;">{html.escape(empty)}</td></tr>'
    return f"""
    <h3 style="margin:24px 0 10px;font-size:12px;text-transform:uppercase;letter-spacing:0.07em;color:{accent};">{html.escape(title)} ({len(tasks)})</h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background:#F9FAFB;">
          <th align="left" style="padding:8px 12px;font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#6B7280;">Task</th>
          <th align="left" style="padding:8px 12px;font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#6B7280;">Status</th>
        </tr>
      </thead>
      <tbody>{rows}</tbody>
    </table>
    """


def _digest_shell(*, headline: str, greeting: str, date_label: str, body_html: str) -> tuple[str, str]:
    base = settings.app_base_url.rstrip("/")
    html_body = f"""
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F4F4F5;font-family:Arial,Helvetica,sans-serif;color:#1A1A2E;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F4F5;padding:24px 12px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid #E5E7EB;">
        <tr>
          <td style="background:#1A1A2E;padding:22px 24px;">
            <div style="color:#E8630A;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Scrumfolks TMS</div>
            <div style="color:#FFFFFF;font-size:22px;font-weight:700;margin-top:6px;">{html.escape(headline)}</div>
            <div style="color:#A1A1AA;font-size:13px;margin-top:6px;">{html.escape(date_label)}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:24px;">
            <p style="margin:0 0 18px;font-size:15px;">{html.escape(greeting)}</p>
            {body_html}
            <p style="margin:28px 0 0;">
              <a href="{html.escape(base)}" style="display:inline-block;background:#E8630A;color:#FFFFFF;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700;font-size:14px;">Open Dashboard →</a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 24px;background:#F9FAFB;color:#6B7280;font-size:12px;line-height:1.5;">
            Scrumfolks Task Management System · automated {html.escape(headline.lower())}
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""
    text_body = f"{headline}\n{date_label}\n\n{greeting}\n\nOpen dashboard: {base}\n"
    return html_body, text_body


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


def build_morning_digest(user: Profile, tasks: list[Task], today: date | None = None) -> tuple[str, str, str]:
    today = today or date.today()
    visible = _user_tasks(tasks, user)
    bags = _base_lists(visible, today)
    body = (
        _section_table("Priority focus", bags["critical"], accent="#C2410C", empty="Clear runway — no critical/high items")
        + _section_table("Due today", bags["due_today"], accent="#2563EB")
        + _section_table("Overdue", bags["overdue"], accent="#DC2626")
        + _section_table("Under review", bags["under_review"], accent="#7C3AED")
        + _section_table("Revision needed", bags["revision"], accent="#EA580C")
        + _section_table("All open work", bags["pending"], empty="No open tasks")
    )
    html_body, text_body = _digest_shell(
        headline="Morning brief",
        greeting=f"Good morning, {user.name}. Here is your plan for today.",
        date_label=today.strftime("%A, %d %B %Y"),
        body_html=body,
    )
    subject = (
        f"Morning brief · {len(bags['critical'])} priority · "
        f"{len(bags['due_today'])} due today · {today:%d %b}"
    )
    return subject, html_body, text_body


def build_evening_digest(user: Profile, tasks: list[Task], today: date | None = None) -> tuple[str, str, str]:
    today = today or date.today()
    visible = _user_tasks(tasks, user)
    bags = _base_lists(visible, today)
    done = bags["completed_today"]
    body = (
        _section_table("Completed today", done, accent="#059669", empty="Nothing marked completed today")
        + _section_table("Still open — priority", bags["critical"], accent="#C2410C")
        + _section_table("Pending overall", bags["pending"])
        + _section_table("Upcoming (7 days)", bags["due_soon"], empty="Nothing due this week")
        + _section_table("Overdue", bags["overdue"], accent="#DC2626")
        + _section_table("Under review", bags["under_review"], accent="#7C3AED")
        + _section_table("Revision needed", bags["revision"], accent="#EA580C")
    )
    html_body, text_body = _digest_shell(
        headline="Evening brief",
        greeting=f"Good evening, {user.name}. Here is how the day looks before you sign off.",
        date_label=today.strftime("%A, %d %B %Y"),
        body_html=body,
    )
    subject = f"Evening brief · {len(done)} done · {len(bags['pending'])} pending · {today:%d %b}"
    return subject, html_body, text_body


def send_morning_digests(db: Session, *, force: bool = False) -> int:
    """Morning brief: one personalized email per active user."""
    today = date.today()
    if not force and not _try_lock(db, int(today.strftime("%Y%m%d") + "1")):
        return 0

    users = db.scalars(select(Profile).where(Profile.is_active.is_(True))).all()
    tasks = db.scalars(select(Task)).all()
    sent = 0
    for user in users:
        if not (user.email or "").strip() and not test_recipient_list():
            continue
        subject, html_body, text_body = build_morning_digest(user, tasks, today)
        try:
            send_email(to=user.email, subject=subject, html=html_body, text=text_body)
            sent += 1
        except Exception as exc:  # noqa: BLE001
            print(f"[morning-digest] failed for {user.email}: {exc}")  # noqa: T201
    return sent


def send_evening_digests(db: Session, *, force: bool = False) -> int:
    """Evening wrap-up: one personalized email per active user."""
    today = date.today()
    if not force and not _try_lock(db, int(today.strftime("%Y%m%d") + "2")):
        return 0

    users = db.scalars(select(Profile).where(Profile.is_active.is_(True))).all()
    tasks = db.scalars(select(Task)).all()
    sent = 0
    for user in users:
        if not (user.email or "").strip() and not test_recipient_list():
            continue
        subject, html_body, text_body = build_evening_digest(user, tasks, today)
        try:
            send_email(to=user.email, subject=subject, html=html_body, text=text_body)
            sent += 1
        except Exception as exc:  # noqa: BLE001
            print(f"[evening-digest] failed for {user.email}: {exc}")  # noqa: T201
    return sent


def send_daily_digests(db: Session) -> int:
    """Backward-compatible alias used by cron — evening wrap-up."""
    return send_evening_digests(db)
