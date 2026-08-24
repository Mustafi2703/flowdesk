"""File attachments for tasks and brands — disk + DB-backed for deploy durability."""

from __future__ import annotations

import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.core.roles import Role
from app.db.session import get_db
from app.models.attachment import FileAttachment
from app.models.attendance import AttendanceLog
from app.models.brand import Brand
from app.models.notification import Notification
from app.models.profile import Profile
from app.models.task import Task
from app.services import object_storage
from app.services.notification_email import send_file_review_email
from app.services.review import next_review_version, review_history_entry
from app.utils.queues import DASHBOARD_CACHE

router = APIRouter(prefix="/attachments", tags=["attachments"])

UPLOAD_ROOT = Path(os.environ.get("UPLOAD_ROOT", str(Path(__file__).resolve().parents[4] / "uploads")))
MAX_BYTES = 100 * 1024 * 1024  # 100 MB (spec §6.1)
# Railway containers have tiny ephemeral disks — default to DB-only bytes.
# Set UPLOAD_WRITE_DISK=true only when a persistent volume is mounted at UPLOAD_ROOT.
WRITE_DISK = os.environ.get("UPLOAD_WRITE_DISK", "false").lower() in {"1", "true", "yes"}
ALLOWED_ENTITY = {"task", "brand"}
_SAFE_NAME = re.compile(r"[^A-Za-z0-9._-]+")


def _ensure_upload_dir(entity_type: str, entity_id: uuid.UUID) -> Path:
    path = UPLOAD_ROOT / entity_type / str(entity_id)
    path.mkdir(parents=True, exist_ok=True)
    return path


def _serialize(row: FileAttachment) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "entity_type": row.entity_type,
        "entity_id": str(row.entity_id),
        "file_name": row.file_name,
        "file_path": row.file_path,
        "file_size": row.file_size,
        "mime_type": row.mime_type,
        "uploaded_by": str(row.uploaded_by) if row.uploaded_by else None,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "review_status": row.review_status or "pending",
        "reviewed_by": str(row.reviewed_by) if row.reviewed_by else None,
        "reviewed_at": row.reviewed_at.isoformat() if row.reviewed_at else None,
        "review_notes": row.review_notes,
        "review_version": getattr(row, "review_version", None),
        "review_history": getattr(row, "review_history", None) or [],
        "url": f"/api/attachments/{row.id}",
    }


def _brand_people(brand: Brand | None) -> set[str]:
    if not brand:
        return set()
    return {str(x) for x in (brand.assigned_members or [])} | {
        str(x) for x in (getattr(brand, "assigned_managers", None) or [])
    }


def _can_access_entity(db: Session, entity_type: str, entity_id: uuid.UUID, user: Profile) -> bool:
    role = Role(user.role)
    if entity_type == "task":
        task = db.get(Task, entity_id)
        if not task:
            return False
        if role in {Role.OWNER, Role.MANAGER, Role.HR, Role.ACCOUNTANT}:
            return True
        if str(user.id) in {str(x) for x in (task.assigned_to or [])}:
            return True
        me = str(user.id)
        if any(me in {str(x) for x in (st.get("assigned_to") or [])} for st in (task.sub_tasks or [])):
            return True
        if task.brand_id:
            brand = db.get(Brand, task.brand_id)
            if me in _brand_people(brand):
                return True
        return False
    if entity_type == "brand":
        brand = db.get(Brand, entity_id)
        if not brand:
            return False
        # Spec: Owner/Manager/HR/Accountant can view; Team only if allocated.
        if role in {Role.OWNER, Role.MANAGER, Role.HR, Role.ACCOUNTANT}:
            return True
        return str(user.id) in _brand_people(brand)
    return False


def _can_upload(user: Profile) -> bool:
    # Spec §3 / Updates.md: Owner, Manager, Team only — no Developer dept.
    role = Role(user.role)
    if role is Role.DEVELOPER:
        role = Role.TEAM
    return role in {Role.OWNER, Role.MANAGER, Role.TEAM}


def store_attachment(
    *,
    db: Session,
    entity_type: str,
    entity_id: uuid.UUID,
    filename: str,
    raw: bytes,
    mime_type: str | None,
    user: Profile,
) -> FileAttachment:
    safe = _SAFE_NAME.sub("_", filename).strip("._") or "file"
    stored_name = f"{uuid.uuid4().hex}_{safe}"
    rel_path = f"{entity_type}/{entity_id}/{stored_name}"
    storage_key: str | None = None
    storage_backend = "db"
    file_data: bytes | None = raw

    if object_storage.storage_enabled():
        storage_key = object_storage.object_key(entity_type, str(entity_id), stored_name)
        try:
            object_storage.put_object(key=storage_key, body=raw, content_type=mime_type)
            storage_backend = "s3"
            file_data = None  # keep Postgres lean — bytes live in the bucket
            rel_path = storage_key
        except Exception:
            # Fall back to DB so uploads never brick the product if R2 is misconfigured.
            storage_key = None
            storage_backend = "db"
            file_data = raw
    elif WRITE_DISK:
        try:
            dest_dir = _ensure_upload_dir(entity_type, entity_id)
            dest = dest_dir / stored_name
            dest.write_bytes(raw)
            rel_path = str(dest.relative_to(UPLOAD_ROOT))
            storage_backend = "disk"
        except OSError:
            rel_path = f"{entity_type}/{entity_id}/{stored_name}"
            storage_backend = "db"

    row = FileAttachment(
        entity_type=entity_type,
        entity_id=entity_id,
        file_name=filename,
        file_path=rel_path,
        file_data=file_data,
        storage_key=storage_key,
        storage_backend=storage_backend,
        file_size=len(raw),
        mime_type=mime_type,
        uploaded_by=user.id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    DASHBOARD_CACHE.invalidate()
    return row


def _advance_task_after_upload(db: Session, task: Task, user: Profile) -> str | None:
    """Move active tasks through the delivery workflow when files are uploaded."""
    if task.status == "Completed":
        return None
    changed: str | None = None
    if task.status == "Not Started":
        task.status = "In Progress"
        changed = "In Progress"
    if task.requires_review and task.status in {"In Progress", "Revision Needed", "Not Started"}:
        if task.status != "Under Review":
            task.status = "Under Review"
            task.review_status = "pending"
            changed = "Under Review"
    if changed:
        task.timeline = [
            *(task.timeline or []),
            {
                "by": str(user.id),
                "action": f"Auto status → {changed} (file uploaded)",
                "fields": ["status"],
                "at": datetime.now(timezone.utc).isoformat(),
            },
        ]
        db.commit()
        db.refresh(task)
        if changed == "Under Review":
            targets = {*(task.assigned_managers or []), *([task.created_by] if task.created_by else [])}
            for manager_id in targets:
                if not manager_id or manager_id == user.id:
                    continue
                db.add(
                    Notification(
                        user_id=manager_id,
                        message=f'"{task.title}" ready for review — new file uploaded',
                        type="task",
                        link=f"/tasks/{task.id}",
                    )
                )
            db.commit()
    return changed


def logo_attachment_id(logo_url: str | None) -> uuid.UUID | None:
    """Parse `/api/attachments/{id}` from a brand logo_url."""
    if not logo_url or "/api/attachments/" not in logo_url:
        return None
    token = logo_url.rstrip("/").rsplit("/", 1)[-1]
    try:
        return uuid.UUID(token)
    except ValueError:
        return None


def remove_attachment_row(db: Session, row: FileAttachment) -> None:
    """Delete attachment bytes + DB row (no auth — caller must authorize)."""
    if getattr(row, "storage_backend", None) == "s3" and getattr(row, "storage_key", None):
        if object_storage.storage_enabled():
            object_storage.delete_object(row.storage_key)
    path = UPLOAD_ROOT / row.file_path
    if path.exists():
        path.unlink()
    db.delete(row)


@router.get("")
def list_attachments(
    entity_type: str,
    entity_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> list[dict[str, Any]]:
    if entity_type not in ALLOWED_ENTITY:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid entity_type")
    if not _can_access_entity(db, entity_type, entity_id, user):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    rows = db.scalars(
        select(FileAttachment)
        .where(FileAttachment.entity_type == entity_type, FileAttachment.entity_id == entity_id)
        .order_by(FileAttachment.created_at.desc())
    ).all()
    return [_serialize(row) for row in rows]


@router.get("/review-queue")
def review_queue(
    status_filter: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """Owner/Manager inbox of uploaded files awaiting review."""
    if Role(user.role) not in {Role.OWNER, Role.MANAGER}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Owner/Manager only")
    stmt = select(FileAttachment).order_by(FileAttachment.created_at.desc()).limit(200)
    if status_filter:
        stmt = stmt.where(FileAttachment.review_status == status_filter)
    rows = db.scalars(stmt).all()
    uploaders = {
        p.id: p
        for p in db.scalars(
            select(Profile).where(Profile.id.in_({r.uploaded_by for r in rows if r.uploaded_by}))
        ).all()
    } if rows else {}
    out = []
    for row in rows:
        item = _serialize(row)
        uploader = uploaders.get(row.uploaded_by) if row.uploaded_by else None
        item["uploader"] = (
            {"id": str(uploader.id), "name": uploader.name, "role": uploader.role}
            if uploader
            else None
        )
        out.append(item)
    return out


@router.get("/recent")
def recent_attachments(
    limit: int = Query(default=24, ge=1, le=50),
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """Recent files the user can access — stored in R2 / disk, metadata in Postgres."""
    rows = db.scalars(
        select(FileAttachment).order_by(FileAttachment.created_at.desc()).limit(300)
    ).all()
    task_ids = {r.entity_id for r in rows if r.entity_type == "task"}
    brand_ids = {r.entity_id for r in rows if r.entity_type == "brand"}
    tasks = {t.id: t for t in db.scalars(select(Task).where(Task.id.in_(task_ids))).all()} if task_ids else {}
    brands = {b.id: b for b in db.scalars(select(Brand).where(Brand.id.in_(brand_ids))).all()} if brand_ids else {}
    out: list[dict[str, Any]] = []
    for row in rows:
        if not _can_access_entity(db, row.entity_type, row.entity_id, user):
            continue
        item = _serialize(row)
        item["entity_type"] = row.entity_type
        item["entity_id"] = str(row.entity_id)
        if row.entity_type == "task" and row.entity_id in tasks:
            t = tasks[row.entity_id]
            item["task_title"] = t.title
            item["task_id"] = str(t.id)
        if row.entity_type == "brand" and row.entity_id in brands:
            item["brand_name"] = brands[row.entity_id].name
        out.append(item)
        if len(out) >= limit:
            break
    return out


class AttachmentReview(BaseModel):
    review_status: str = Field(pattern="^(pending|approved|rejected)$")
    review_notes: str | None = None


_IST = timezone(timedelta(hours=5, minutes=30))


def _is_clocked_in_today(db: Session, user: Profile) -> bool:
    today = datetime.now(_IST).date()
    log = db.scalar(
        select(AttendanceLog).where(
            AttendanceLog.user_id == user.id,
            AttendanceLog.date == today,
        )
    )
    return log is not None and log.login_time is not None and log.logout_time is None


@router.patch("/{attachment_id}/review")
def review_attachment(
    attachment_id: uuid.UUID,
    payload: AttachmentReview,
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> dict[str, Any]:
    if Role(user.role) not in {Role.OWNER, Role.MANAGER}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Owner/Manager only")
    row = db.get(FileAttachment, attachment_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found")
    notes = (payload.review_notes or "").strip()
    if payload.review_status == "rejected" and len(notes) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Add comments / suggestions when rejecting",
        )
    current_version = row.review_version or "1"
    history = list(row.review_history or [])
    history.append(
        review_history_entry(
            version=current_version,
            status=payload.review_status,
            notes=notes,
            by=user.id,
            by_name=user.name,
        )
    )
    row.review_history = history
    row.review_status = payload.review_status
    row.review_notes = notes or None
    row.reviewed_by = user.id
    row.reviewed_at = datetime.now(timezone.utc)
    if payload.review_status == "rejected":
        row.review_version = next_review_version(current_version)
        if row.entity_type == "task":
            task = db.get(Task, row.entity_id)
            if task:
                task.status = "Revision Needed"
                task.review_status = "rejected"
                task_history = list(task.review_history or [])
                task_history.append(
                    review_history_entry(
                        version=task.review_version or current_version,
                        status="rejected",
                        notes=notes,
                        by=user.id,
                        by_name=user.name,
                    )
                )
                task.review_history = task_history
                task.review_version = next_review_version(task.review_version or "1")
                for assignee_id in task.assigned_to or []:
                    db.add(
                        Notification(
                            user_id=assignee_id,
                            message=f'File "{row.file_name}" on "{task.title}" was rejected (v{current_version}): {notes}',
                            type="task",
                            link=f"/tasks/{task.id}",
                        )
                    )
    elif payload.review_status == "approved" and row.entity_type == "task":
        task = db.get(Task, row.entity_id)
        if task:
            task.review_status = "approved"
            task_history = list(task.review_history or [])
            task_history.append(
                review_history_entry(
                    version=task.review_version or current_version,
                    status="approved",
                    notes=notes,
                    by=user.id,
                    by_name=user.name,
                )
            )
            task.review_history = task_history
            for assignee_id in task.assigned_to or []:
                db.add(
                    Notification(
                        user_id=assignee_id,
                        message=f'File "{row.file_name}" on "{task.title}" was approved (v{current_version})',
                        type="task",
                        link=f"/tasks/{task.id}",
                    )
                )
    db.commit()
    db.refresh(row)
    if row.entity_type == "task":
        task = db.get(Task, row.entity_id)
        if task:
            send_file_review_email(
                db,
                task=task,
                file_name=row.file_name,
                review_status=payload.review_status,
                review_notes=notes,
                version=current_version,
                reviewer_name=user.name,
                assignee_ids=task.assigned_to or [],
            )
    DASHBOARD_CACHE.invalidate()
    return _serialize(row)


@router.post("", status_code=status.HTTP_201_CREATED)
async def upload_attachment(
    entity_type: str = Form(...),
    entity_id: uuid.UUID = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> dict[str, Any]:
    if not _can_upload(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot upload files")
    if entity_type not in ALLOWED_ENTITY:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid entity_type")
    if not _can_access_entity(db, entity_type, entity_id, user):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing filename")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file")
    if len(raw) > MAX_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File too large (max 100MB)")

    row = store_attachment(
        db=db,
        entity_type=entity_type,
        entity_id=entity_id,
        filename=file.filename,
        raw=raw,
        mime_type=file.content_type,
        user=user,
    )
    task_status: str | None = None
    if entity_type == "task":
        task = db.get(Task, entity_id)
        if task:
            task_status = _advance_task_after_upload(db, task, user)
    payload = _serialize(row)
    if task_status:
        payload["task_status"] = task_status
    return payload


def _serve_attachment(row: FileAttachment, *, as_attachment: bool = False):
    media = row.mime_type or "application/octet-stream"
    disposition = "attachment" if as_attachment else "inline"
    disp = f'{disposition}; filename="{row.file_name}"'
    # 1) Object bucket (R2 / S3)
    if getattr(row, "storage_backend", None) == "s3" and getattr(row, "storage_key", None):
        if object_storage.storage_enabled():
            content = object_storage.get_object_bytes(row.storage_key)
            if content:
                return Response(
                    content=content,
                    media_type=media,
                    headers={"Content-Disposition": disp},
                )
    # 2) Local disk
    path = UPLOAD_ROOT / row.file_path
    if path.exists():
        return FileResponse(
            path,
            filename=row.file_name,
            media_type=media,
            content_disposition_type=disposition,
        )
    # 3) Legacy BYTEA in Postgres
    raw = row.file_data
    if raw is not None:
        content = bytes(raw) if not isinstance(raw, (bytes, bytearray)) else bytes(raw)
        if content:
            return Response(
                content=content,
                media_type=media,
                headers={"Content-Disposition": disp},
            )
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File missing on disk")


@router.get("/{attachment_id}")
def view_attachment(
    attachment_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
):
    row = db.get(FileAttachment, attachment_id)
    if not row or not _can_access_entity(db, row.entity_type, row.entity_id, user):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found")
    try:
        return _serve_attachment(row, as_attachment=False)
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Could not read file ({exc.__class__.__name__})",
        ) from exc


@router.get("/{attachment_id}/download")
def download_attachment(
    attachment_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
):
    row = db.get(FileAttachment, attachment_id)
    if not row or not _can_access_entity(db, row.entity_type, row.entity_id, user):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found")
    try:
        return _serve_attachment(row, as_attachment=True)
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Could not read file ({exc.__class__.__name__})",
        ) from exc


@router.delete("/{attachment_id}")
def delete_attachment(
    attachment_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> dict[str, bool]:
    row = db.get(FileAttachment, attachment_id)
    if not row or not _can_access_entity(db, row.entity_type, row.entity_id, user):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found")
    if Role(user.role) not in {Role.OWNER, Role.MANAGER} and row.uploaded_by != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete this file")
    if getattr(row, "storage_backend", None) == "s3" and getattr(row, "storage_key", None):
        if object_storage.storage_enabled():
            object_storage.delete_object(row.storage_key)
    path = UPLOAD_ROOT / row.file_path
    if path.exists():
        path.unlink()
    # Clear brand logo if this attachment was the logo
    brands = db.scalars(select(Brand).where(Brand.logo_url.contains(str(row.id)))).all()
    for brand in brands:
        brand.logo_url = None
    db.delete(row)
    db.commit()
    DASHBOARD_CACHE.invalidate()
    return {"ok": True}
