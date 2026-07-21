"""File attachments for tasks and brands — disk + DB-backed for deploy durability."""

from __future__ import annotations

import os
import re
import uuid
from datetime import datetime, timezone
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
from app.models.brand import Brand
from app.models.profile import Profile
from app.models.task import Task
from app.utils.queues import DASHBOARD_CACHE

router = APIRouter(prefix="/attachments", tags=["attachments"])

UPLOAD_ROOT = Path(os.environ.get("UPLOAD_ROOT", str(Path(__file__).resolve().parents[4] / "uploads")))
MAX_BYTES = 100 * 1024 * 1024  # 100 MB (spec §6.1)
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
    dest_dir = _ensure_upload_dir(entity_type, entity_id)
    dest = dest_dir / stored_name
    try:
        dest.write_bytes(raw)
        rel_path = str(dest.relative_to(UPLOAD_ROOT))
    except OSError:
        # Disk may be ephemeral/read-only — DB bytes are the durable copy.
        rel_path = f"{entity_type}/{entity_id}/{stored_name}"

    row = FileAttachment(
        entity_type=entity_type,
        entity_id=entity_id,
        file_name=filename,
        file_path=rel_path,
        file_data=raw,
        file_size=len(raw),
        mime_type=mime_type,
        uploaded_by=user.id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    DASHBOARD_CACHE.invalidate()
    return row


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


class AttachmentReview(BaseModel):
    review_status: str = Field(pattern="^(pending|approved|rejected)$")
    review_notes: str | None = None


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
    row.review_status = payload.review_status
    row.review_notes = payload.review_notes
    row.reviewed_by = user.id
    row.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)
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
    return _serialize(row)


def _serve_attachment(row: FileAttachment):
    path = UPLOAD_ROOT / row.file_path
    media = row.mime_type or "application/octet-stream"
    if path.exists():
        return FileResponse(path, filename=row.file_name, media_type=media)
    raw = row.file_data
    if raw is not None:
        content = bytes(raw) if not isinstance(raw, (bytes, bytearray)) else bytes(raw)
        if content:
            return Response(
                content=content,
                media_type=media,
                headers={"Content-Disposition": f'inline; filename="{row.file_name}"'},
            )
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File missing on disk")


@router.get("/{attachment_id}")
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
        return _serve_attachment(row)
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001 — surface corrupt blobs as 404, not 500
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
