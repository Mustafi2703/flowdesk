"""File attachments for tasks and brands."""

from __future__ import annotations

import re
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
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

UPLOAD_ROOT = Path(__file__).resolve().parents[4] / "uploads"
MAX_BYTES = 15 * 1024 * 1024  # 15 MB
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
        "url": f"/api/v1/attachments/{row.id}/download",
    }


def _can_access_entity(db: Session, entity_type: str, entity_id: uuid.UUID, user: Profile) -> bool:
    role = Role(user.role)
    if entity_type == "task":
        task = db.get(Task, entity_id)
        if not task:
            return False
        if role in {Role.OWNER, Role.MANAGER, Role.HR, Role.ACCOUNTANT}:
            return True
        if user.id in (task.assigned_to or []):
            return True
        me = str(user.id)
        return any(me in {str(x) for x in (st.get("assigned_to") or [])} for st in (task.sub_tasks or []))
    if entity_type == "brand":
        brand = db.get(Brand, entity_id)
        if not brand:
            return False
        if role in {Role.OWNER, Role.MANAGER, Role.HR, Role.ACCOUNTANT}:
            return True
        return user.id in (brand.assigned_members or [])
    return False


def _can_upload(user: Profile) -> bool:
    return Role(user.role) in {Role.OWNER, Role.MANAGER, Role.TEAM, Role.DEVELOPER, Role.ACCOUNTANT, Role.HR}


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
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File too large (max 15MB)")

    safe = _SAFE_NAME.sub("_", file.filename).strip("._") or "file"
    stored_name = f"{uuid.uuid4().hex}_{safe}"
    dest_dir = _ensure_upload_dir(entity_type, entity_id)
    dest = dest_dir / stored_name
    dest.write_bytes(raw)

    rel_path = str(dest.relative_to(UPLOAD_ROOT))
    row = FileAttachment(
        entity_type=entity_type,
        entity_id=entity_id,
        file_name=file.filename,
        file_path=rel_path,
        file_size=len(raw),
        mime_type=file.content_type,
        uploaded_by=user.id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    DASHBOARD_CACHE.invalidate()
    return _serialize(row)


@router.get("/{attachment_id}/download")
def download_attachment(
    attachment_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> FileResponse:
    row = db.get(FileAttachment, attachment_id)
    if not row or not _can_access_entity(db, row.entity_type, row.entity_id, user):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found")
    path = UPLOAD_ROOT / row.file_path
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File missing on disk")
    return FileResponse(path, filename=row.file_name, media_type=row.mime_type or "application/octet-stream")


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
    db.delete(row)
    db.commit()
    DASHBOARD_CACHE.invalidate()
    return {"ok": True}
