"""Protected cron endpoints for scheduled jobs."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.deps import require_cron_secret
from app.db.session import get_db
from app.models.profile import Profile
from app.models.task import Task
from app.scripts.seed import seed_users_only, seed, delete_full_demo_data
from app.services.digests import send_daily_digests, send_evening_digests, send_morning_digests
from app.services.email import send_email
from app.services.task_brief_email import build_task_brief_email, send_task_brief_emails
from app.core.config import settings

router = APIRouter(prefix="/cron", tags=["cron"], dependencies=[Depends(require_cron_secret)])


@router.post("/daily-digests")
def daily_digests(db: Session = Depends(get_db)) -> dict[str, int]:
    """Evening wrap-up (alias). Prefer /morning-digests and /evening-digests."""
    return {"sent": send_daily_digests(db)}


@router.post("/morning-digests")
def morning_digests(db: Session = Depends(get_db)) -> dict[str, int]:
    return {"sent": send_morning_digests(db)}


@router.post("/evening-digests")
def evening_digests(db: Session = Depends(get_db)) -> dict[str, int]:
    return {"sent": send_evening_digests(db)}


@router.post("/repair-demo-users")
def repair_demo_users() -> dict[str, bool]:
    """Reset demo account passwords and hierarchy without wiping workspace data."""
    seed_users_only()
    return {"ok": True}


@router.post("/seed-full-demo")
def seed_full_demo() -> dict[str, bool]:
    """Seed full demo (brands/tasks/announcements/leaves + demo documents)."""
    seed()
    return {"ok": True}


@router.post("/cleanup-full-demo")
def cleanup_full_demo() -> dict:
    """Delete only the demo content inserted by `seed()` (users preserved)."""
    counts = delete_full_demo_data()
    return {"ok": True, **counts}


@router.post("/test-email")
def test_email() -> dict:
    """Send a simple test email to EMAIL_TEST_RECIPIENT (or SMTP user)."""
    to = (settings.email_test_recipient or settings.smtp_user or "").strip()
    if not to:
        return {"ok": False, "error": "Set EMAIL_TEST_RECIPIENT or SMTP_USER"}
    if settings.email_provider == "smtp" and not settings.smtp_password:
        return {"ok": False, "error": "Set SMTP_PASSWORD (Gmail App Password) on Railway backend"}
    try:
        send_email(
            to=to,
            subject="Scrumfolks TMS — email test",
            html="<h2>Scrumfolks TMS</h2><p>Email delivery is working.</p>",
            text="Scrumfolks TMS — email delivery is working.",
        )
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc), "to": to}
    return {"ok": True, "to": to}


@router.post("/test-task-brief")
def test_task_brief(
    db: Session = Depends(get_db),
    task_id: str | None = Query(default=None),
) -> dict:
    """Send a structured task-brief email for the latest task (or a specific task_id)."""
    task = None
    if task_id:
        try:
            task = db.get(Task, uuid.UUID(str(task_id)))
        except ValueError:
            return {"ok": False, "error": "Invalid task_id"}
    if task is None:
        task = db.scalar(select(Task).order_by(Task.created_at.desc()).limit(1))
    if task is None:
        return {"ok": False, "error": "No tasks in database"}

    to = (settings.email_test_recipient or settings.smtp_user or "").strip()
    if not to:
        return {"ok": False, "error": "Set EMAIL_TEST_RECIPIENT or SMTP_USER"}
    if settings.email_provider == "smtp" and not settings.smtp_password:
        return {"ok": False, "error": "Set SMTP_PASSWORD (Gmail App Password) on Railway backend"}

    assignee_id = (task.assigned_to or [None])[0] or task.created_by
    assignee_row = db.get(Profile, assignee_id) if assignee_id else None
    assignee = assignee_row or Profile(
        id=assignee_id or uuid.uuid4(),
        name="Recipient",
        email=to,
        password_hash="unused",
        role="team",
    )
    assigner = db.get(Profile, task.assigned_by or task.created_by) if (task.assigned_by or task.created_by) else None
    brand = None
    if task.brand_id:
        from app.models.brand import Brand

        brand = db.get(Brand, task.brand_id)

    # Show Drive formatting even if this task has no folder yet.
    snapshot_links = list(getattr(task, "external_links", None) or [])
    if not snapshot_links:
        task.external_links = [
            {"label": "Sample Google Drive folder", "url": "https://drive.google.com/drive/folders/scrumfolks-sample"}
        ]

    subject, html_body, text_body = build_task_brief_email(
        task=task,
        assignee=assignee,
        assigner=assigner,
        brand=brand,
        co_assignees=[assignee.name] if assignee.name else None,
    )
    task.external_links = snapshot_links
    try:
        send_email(to=to, subject=subject, html=html_body, text=text_body)
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc), "to": to, "task_id": str(task.id)}
    return {"ok": True, "to": to, "task_id": str(task.id), "subject": subject}


@router.post("/send-task-brief/{task_id}")
def cron_send_task_brief(task_id: str, db: Session = Depends(get_db)) -> dict:
    """Email task briefs to all current assignees (cron/admin use)."""
    try:
        tid = uuid.UUID(str(task_id))
    except ValueError:
        return {"ok": False, "error": "Invalid task_id"}
    task = db.get(Task, tid)
    if not task:
        return {"ok": False, "error": "Task not found"}
    assigner = db.get(Profile, task.assigned_by or task.created_by) if (task.assigned_by or task.created_by) else None
    sent = send_task_brief_emails(db, task, assigner=assigner, assignee_ids=task.assigned_to or [])
    return {"ok": True, "sent": sent, "task_id": str(task.id)}
