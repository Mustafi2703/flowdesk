"""Transactional emails for leave decisions and file review outcomes."""

from __future__ import annotations

import html
from typing import Iterable

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.profile import Profile
from app.models.task import Task
from app.services.email import send_email


def _recipient_email(profile: Profile) -> str | None:
    override = (settings.email_test_recipient or "").strip()
    if override:
        return override
    email = (profile.email or "").strip()
    return email or None


def _wrap(title: str, body_html: str, cta_label: str, cta_url: str) -> tuple[str, str]:
    html_body = f"""
<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;color:#1A1A2E;">
  <div style="padding:20px 0 12px;border-bottom:3px solid #FF6B1A;">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;color:#FF6B1A;text-transform:uppercase;">Scrumfolks TMS</div>
    <h1 style="margin:8px 0 0;font-size:20px;line-height:1.3;">{html.escape(title)}</h1>
  </div>
  <div style="padding:18px 0;font-size:14px;line-height:1.55;color:#374151;">{body_html}</div>
  <a href="{html.escape(cta_url)}" style="display:inline-block;background:#FF6B1A;color:#fff;text-decoration:none;font-weight:700;font-size:13px;padding:10px 18px;border-radius:8px;">{html.escape(cta_label)}</a>
  <p style="margin:20px 0 0;font-size:11px;color:#9CA3AF;">This is an automated message from Scrumfolks TMS.</p>
</div>"""
    plain_body = html.unescape(body_html.replace("<br>", "\n").replace("<br/>", "\n"))
    text_body = f"{title}\n\n{plain_body}\n\n{cta_label}: {cta_url}\n"
    return html_body, text_body


def _safe_send(*, to: str | None, subject: str, html_body: str, text_body: str) -> bool:
    if not to:
        return False
    try:
        send_email(to=to, subject=subject, html=html_body, text=text_body)
        return True
    except Exception as exc:  # noqa: BLE001
        print(f"[notification-email] failed for {to}: {exc}")  # noqa: T201
        return False


def send_leave_decision_email(
    *,
    applicant: Profile,
    leave_type: str,
    start_date: str,
    end_date: str,
    days: int,
    decision: str,
    rejection_reason: str | None,
    reviewer_name: str,
) -> bool:
    base = settings.app_base_url.rstrip("/")
    url = f"{base}/leave"
    if decision == "Approved":
        title = "Leave approved"
        body = (
            f"Hi {html.escape(applicant.name)},<br><br>"
            f"Your <strong>{html.escape(leave_type)}</strong> leave "
            f"({html.escape(start_date)} → {html.escape(end_date)}, {days} day(s)) was "
            f"<strong style='color:#059669;'>approved</strong> by {html.escape(reviewer_name)}."
        )
    else:
        reason = html.escape(rejection_reason or "No reason provided")
        title = "Leave rejected — submit a new request"
        body = (
            f"Hi {html.escape(applicant.name)},<br><br>"
            f"Your <strong>{html.escape(leave_type)}</strong> leave request was "
            f"<strong style='color:#DC2626;'>rejected</strong> by {html.escape(reviewer_name)}.<br><br>"
            f"<strong>Reason:</strong> {reason}<br><br>"
            "Rejected leave does not count against your balance. "
            "Please submit a <strong>new leave request</strong> if you still need time off."
        )
    html_body, text_body = _wrap(title, body, "Open Leave", url)
    subject = f"[Scrumfolks] {title}"
    return _safe_send(to=_recipient_email(applicant), subject=subject, html_body=html_body, text_body=text_body)


def send_leave_submitted_email(
    *,
    recipients: Iterable[Profile],
    applicant_name: str,
    leave_type: str,
    start_date: str,
    end_date: str,
    days: int,
) -> int:
    base = settings.app_base_url.rstrip("/")
    url = f"{base}/leave"
    title = "New leave request pending review"
    body = (
        f"{html.escape(applicant_name)} submitted a <strong>{html.escape(leave_type)}</strong> leave "
        f"({html.escape(start_date)} → {html.escape(end_date)}, {days} day(s)) for your review."
    )
    html_body, text_body = _wrap(title, body, "Review leave", url)
    subject = f"[Scrumfolks] {title}"
    sent = 0
    seen: set[str] = set()
    for profile in recipients:
        to = _recipient_email(profile)
        if not to or to.lower() in seen:
            continue
        seen.add(to.lower())
        if _safe_send(to=to, subject=subject, html_body=html_body, text_body=text_body):
            sent += 1
        if (settings.email_test_recipient or "").strip():
            break
    return sent


def send_file_review_email(
    db: Session,
    *,
    task: Task,
    file_name: str,
    review_status: str,
    review_notes: str | None,
    version: str,
    reviewer_name: str,
    assignee_ids: Iterable,
) -> int:
    base = settings.app_base_url.rstrip("/")
    task_url = f"{base}/tasks/{task.id}"
    notes = (review_notes or "").strip()
    if review_status == "approved":
        title = f"File approved — {task.title}"
        body = (
            f'Your upload <strong>{html.escape(file_name)}</strong> (v{html.escape(version)}) on '
            f'<strong>{html.escape(task.title)}</strong> was approved by {html.escape(reviewer_name)}.'
        )
        if notes:
            body += f"<br><br><strong>Comments:</strong> {html.escape(notes)}"
    else:
        title = f"Revision needed — {task.title}"
        body = (
            f'Your upload <strong>{html.escape(file_name)}</strong> (v{html.escape(version)}) on '
            f'<strong>{html.escape(task.title)}</strong> was rejected by {html.escape(reviewer_name)}.<br><br>'
            f"<strong>Feedback:</strong> {html.escape(notes or 'See task for details')}<br><br>"
            "Upload a revised file on the task to send it back for review."
        )
    html_body, text_body = _wrap(title, body, "Open task", task_url)
    subject = f"[Scrumfolks] {title}"

    from sqlalchemy import select

    profiles = {
        p.id: p
        for p in db.scalars(select(Profile).where(Profile.id.in_(list(assignee_ids)))).all()
    }
    sent = 0
    seen: set[str] = set()
    for aid in assignee_ids:
        profile = profiles.get(aid)
        if not profile:
            continue
        to = _recipient_email(profile)
        if not to or to.lower() in seen:
            continue
        seen.add(to.lower())
        if _safe_send(to=to, subject=subject, html_body=html_body, text_body=text_body):
            sent += 1
        if (settings.email_test_recipient or "").strip():
            break
    return sent
