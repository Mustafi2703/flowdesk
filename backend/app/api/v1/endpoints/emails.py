"""Owner/Manager email actions — task briefs and digests on demand."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.core.roles import Role
from app.db.session import get_db
from app.models.profile import Profile
from app.models.task import Task
from app.services.digests import build_morning_digest, send_evening_digests, send_morning_digests
from app.services.email import send_email, test_recipient_list
from app.services.task_brief_email import send_task_brief_emails
from app.services.task_visibility import can_view_task_db

router = APIRouter(prefix="/emails", tags=["emails"])


def _require_mgmt(user: Profile) -> None:
    if Role(user.role) not in {Role.OWNER, Role.MANAGER}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Owner/Manager only")


@router.post("/task-brief/{task_id}")
def send_task_brief(
    task_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> dict:
    """Resend the assignment brief to current assignees."""
    _require_mgmt(user)
    task = db.get(Task, task_id)
    if not task or not can_view_task_db(db, task, user):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    sent = send_task_brief_emails(db, task, assigner=user, assignee_ids=task.assigned_to or [])
    return {"ok": True, "sent": sent, "task_id": str(task.id)}


@router.post("/morning-digest")
def trigger_morning_digest(
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> dict:
    """Send morning priority briefs to all active users (Owner/Manager)."""
    _require_mgmt(user)
    sent = send_morning_digests(db, force=True)
    targets = test_recipient_list()
    return {
        "ok": True,
        "sent": sent,
        "kind": "morning",
        "test_recipients": targets,
        "note": "Each active user gets a personalized brief; test mode duplicates to all EMAIL_TEST_RECIPIENT addresses.",
    }


@router.post("/evening-digest")
def trigger_evening_digest(
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> dict:
    """Send evening wrap-up briefs to all active users (Owner/Manager)."""
    _require_mgmt(user)
    sent = send_evening_digests(db, force=True)
    return {"ok": True, "sent": sent, "kind": "evening"}


@router.post("/test")
def send_test_email(
    user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Send test emails to EMAIL_TEST_RECIPIENT list (or signed-in user)."""
    _require_mgmt(user)
    targets = test_recipient_list()
    to_label = ", ".join(targets) if targets else (user.email or "").strip()
    if not to_label:
        return {"ok": False, "error": "No recipient email on your account or EMAIL_TEST_RECIPIENT"}
    try:
        send_email(
            to=user.email or to_label.split(",")[0],
            subject="Scrumfolks TMS — email connection test",
            html=f"""
            <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;">
              <h2 style="color:#E8630A;">Scrumfolks TMS</h2>
              <p>Hi {user.name}, SMTP delivery is working.</p>
              <p style="color:#6B7280;font-size:13px;">Test recipients: {to_label}</p>
            </div>
            """,
            text=f"Hi {user.name}, SMTP delivery is working. Test recipients: {to_label}",
        )
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc), "to": to_label}
    return {"ok": True, "to": to_label, "test_mode": bool(targets)}


@router.post("/test-morning-sample")
def send_test_morning_sample(
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> dict:
    """Send the signed-in user's morning brief to test inboxes (format QA)."""
    _require_mgmt(user)
    tasks = db.scalars(select(Task)).all()
    subject, html_body, text_body = build_morning_digest(user, tasks)
    targets = test_recipient_list()
    to_label = ", ".join(targets) if targets else (user.email or "").strip()
    try:
        send_email(to=user.email or to_label.split(",")[0], subject=subject, html=html_body, text=text_body)
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc), "to": to_label}
    return {"ok": True, "to": to_label, "subject": subject, "kind": "morning-sample"}
