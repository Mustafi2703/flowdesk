"""Google Drive connect + create task folders."""

from __future__ import annotations

import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.api.v1.deps import get_current_user
from app.core.config import settings
from app.core.roles import Role
from app.db.session import get_db
from app.models.profile import Profile
from app.models.task import Task
from app.services import google_drive as drive

router = APIRouter(prefix="/drive", tags=["drive"])


def _require_owner(user: Profile) -> None:
    if Role(user.role) != Role.OWNER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Owner only")


def _require_mgmt(user: Profile) -> None:
    if Role(user.role) not in {Role.OWNER, Role.MANAGER}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Owner/Manager only")


@router.get("/status")
def drive_status(
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> dict:
    _require_mgmt(user)
    row = drive.get_integration(db)
    configured = drive.drive_configured() and bool(settings.google_oauth_redirect_uri)
    redirect = None
    if configured:
        try:
            redirect = drive.redirect_uri()
        except RuntimeError:
            redirect = None
            configured = False
    return {
        "configured": configured,
        "connected": bool(row),
        "account_email": row.account_email if row else None,
        "root_folder_url": row.root_folder_url if row else None,
        "redirect_uri": redirect,
    }


@router.get("/connect")
def drive_connect(
    user: Profile = Depends(get_current_user),
) -> dict:
    _require_owner(user)
    if not drive.drive_configured() or not settings.google_oauth_redirect_uri:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, and GOOGLE_OAUTH_REDIRECT_URI on Railway backend",
        )
    state = f"{user.id}:{secrets.token_urlsafe(16)}"
    return {"url": drive.auth_url(state=state)}


@router.get("/callback")
def drive_callback(
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> RedirectResponse:
    frontend = settings.app_base_url.rstrip("/")
    if error:
        return RedirectResponse(f"{frontend}/overview?drive=error&msg={error}", status_code=302)
    if not code or not state or ":" not in state:
        return RedirectResponse(f"{frontend}/overview?drive=error&msg=missing_code", status_code=302)
    user_id = state.split(":", 1)[0]
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        return RedirectResponse(f"{frontend}/overview?drive=error&msg=bad_state", status_code=302)
    user = db.get(Profile, uid)
    if not user or Role(user.role) != Role.OWNER:
        return RedirectResponse(f"{frontend}/overview?drive=error&msg=unauthorized", status_code=302)
    try:
        payload = drive.exchange_code(code)
        drive.save_connection(db, token_payload=payload, connected_by=user.id)
    except Exception:  # noqa: BLE001
        return RedirectResponse(f"{frontend}/overview?drive=error&msg=token_exchange", status_code=302)
    return RedirectResponse(f"{frontend}/overview?drive=connected", status_code=302)


@router.post("/disconnect")
def drive_disconnect(
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> dict:
    _require_owner(user)
    row = drive.get_integration(db)
    if row:
        row.is_active = False
        db.commit()
    return {"ok": True}


@router.post("/tasks/{task_id}/folder")
def create_task_drive_folder(
    task_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> dict:
    _require_mgmt(user)
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    if not drive.get_integration(db):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Connect Google Drive from the Dashboard first (Owner)",
        )
    try:
        folder = drive.create_task_folder(db, task_title=task.title)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    links = list(task.external_links or [])
    already = any(
        isinstance(x, dict) and str(x.get("url") or "") == folder["url"] for x in links
    )
    if not already:
        links.append({"label": folder["label"], "url": folder["url"], "drive_id": folder["id"]})
        task.external_links = links
        flag_modified(task, "external_links")
        db.commit()
        db.refresh(task)
    return {"ok": True, "folder": folder, "external_links": task.external_links}
