"""Owner/Manager email actions — task briefs and digests on demand."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.core.roles import Role
from app.db.session import get_db
from app.models.profile import Profile
from app.models.task import Task
from app.services.digests import send_evening_digests, send_morning_digests
from app.services.email import send_email
from app.services.task_brief_email import send_task_brief_emails
from app.core.config import settings

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
    if not task:
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
    return {"ok": True, "sent": sent, "kind": "morning"}


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
) -> dict:
    """Send a test email to the signed-in owner/manager."""
    _require_mgmt(user)
    to = (settings.email_test_recipient or user.email or "").strip()
    if not to:
        return {"ok": False, "error": "No recipient email on your account"}
    try:
        send_email(
            to=to,
            subject="Scrumfolks TMS — email test",
            html=f"<h2>Scrumfolks TMS</h2><p>Hi {user.name}, email delivery is working.</p>",
            text=f"Hi {user.name}, email delivery is working.",
        )
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc), "to": to}
    return {"ok": True, "to": to}
