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
from app.services.data_cleanup import run_data_cleanup
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


@router.post("/cleanup-data")
def cleanup_data(
    db: Session = Depends(get_db),
    notification_days: int = Query(default=90, ge=30, le=365),
    chat_days: int = Query(default=180, ge=30, le=730),
) -> dict:
    """Purge old read notifications and stale closed-task chat (run daily via Railway cron)."""
    return run_data_cleanup(db, notification_days=notification_days, chat_days=chat_days)


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


@router.post("/cleanup-created-on")
def cleanup_created_on(
    day: str = Query(..., description="IST calendar day YYYY-MM-DD, e.g. 2026-10-08"),
    keep_scrumfolks_users: bool = Query(
        default=True,
        description="Keep *@scrumfolks.com accounts even if created that day",
    ),
    db: Session = Depends(get_db),
) -> dict:
    """Delete workspace rows created on an IST day (UAT scrub). Keeps older data.

    Removes: tasks, brands (with no remaining tasks), announcements, leave requests,
    and non-@scrumfolks.com users created that day. Demo login emails are never deleted.
    """
    from datetime import date as date_cls, datetime, timedelta, timezone

    from sqlalchemy import delete, or_

    from app.models.announcement import Announcement
    from app.models.attachment import FileAttachment
    from app.models.brand import Brand
    from app.models.leave import LeaveRequest
    from app.models.notification import Notification
    from app.models.task import Task, TaskChat
    from app.utils.queues import DASHBOARD_CACHE

    try:
        target = date_cls.fromisoformat(day)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="day must be YYYY-MM-DD") from exc

    ist = timezone(timedelta(hours=5, minutes=30))
    start = datetime(target.year, target.month, target.day, 0, 0, 0, tzinfo=ist).astimezone(timezone.utc)
    end = start + timedelta(days=1)

    demo_emails = {
        "owner@scrumfolks.com",
        "manager@scrumfolks.com",
        "team@scrumfolks.com",
        "hr@scrumfolks.com",
        "accountant@scrumfolks.com",
        "dev@scrumfolks.com",
    }
    counts = {
        "tasks": 0,
        "task_chats": 0,
        "brands": 0,
        "announcements": 0,
        "leaves": 0,
        "users": 0,
        "files": 0,
        "notifications": 0,
    }
    deleted: dict[str, list[str]] = {
        "tasks": [],
        "brands": [],
        "announcements": [],
        "leaves": [],
        "users": [],
    }

    day_tasks = list(
        db.scalars(select(Task).where(Task.created_at >= start, Task.created_at < end)).all()
    )
    task_ids = [t.id for t in day_tasks]
    if task_ids:
        chats = db.execute(delete(TaskChat).where(TaskChat.task_id.in_(task_ids)))
        counts["task_chats"] = int(chats.rowcount or 0)
        files = db.execute(
            delete(FileAttachment).where(
                FileAttachment.entity_type == "task",
                FileAttachment.entity_id.in_(task_ids),
            )
        )
        counts["files"] += int(files.rowcount or 0)
        for t in day_tasks:
            deleted["tasks"].append(t.title or str(t.id))
            db.delete(t)
            counts["tasks"] += 1
        db.flush()

    day_brands = list(
        db.scalars(select(Brand).where(Brand.created_at >= start, Brand.created_at < end)).all()
    )
    for brand in day_brands:
        still_has = db.scalar(select(Task.id).where(Task.brand_id == brand.id).limit(1))
        if still_has:
            continue
        files = db.execute(
            delete(FileAttachment).where(
                FileAttachment.entity_type == "brand",
                FileAttachment.entity_id == brand.id,
            )
        )
        counts["files"] += int(files.rowcount or 0)
        deleted["brands"].append(brand.name or str(brand.id))
        db.delete(brand)
        counts["brands"] += 1

    day_anns = list(
        db.scalars(
            select(Announcement).where(Announcement.created_at >= start, Announcement.created_at < end)
        ).all()
    )
    for ann in day_anns:
        notif = db.execute(
            delete(Notification).where(
                or_(
                    Notification.message.ilike(f"%{ann.title}%"),
                    Notification.link == "/announcements",
                ),
                Notification.created_at >= start,
                Notification.created_at < end,
            )
        )
        counts["notifications"] += int(notif.rowcount or 0)
        deleted["announcements"].append(ann.title or str(ann.id))
        db.delete(ann)
        counts["announcements"] += 1

    day_leaves = list(
        db.scalars(
            select(LeaveRequest).where(LeaveRequest.created_at >= start, LeaveRequest.created_at < end)
        ).all()
    )
    for leave in day_leaves:
        deleted["leaves"].append(str(leave.id))
        db.delete(leave)
        counts["leaves"] += 1

    day_users = list(
        db.scalars(select(Profile).where(Profile.created_at >= start, Profile.created_at < end)).all()
    )
    for profile in day_users:
        email = (profile.email or "").lower().strip()
        if email in demo_emails:
            continue
        if keep_scrumfolks_users and email.endswith("@scrumfolks.com"):
            continue
        db.execute(delete(Notification).where(Notification.user_id == profile.id))
        deleted["users"].append(email or str(profile.id))
        db.delete(profile)
        counts["users"] += 1

    db.commit()
    DASHBOARD_CACHE.invalidate()
    return {"ok": True, "day": day, "counts": counts, "deleted": deleted}


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
