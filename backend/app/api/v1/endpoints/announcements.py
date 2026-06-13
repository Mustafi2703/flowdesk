"""Announcements with the joined `creator` shape the demo UI expects."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.core.roles import Role
from app.db.session import get_db
from app.models.announcement import Announcement
from app.models.notification import Notification
from app.models.profile import Profile
from app.schemas.announcement import AnnouncementCreate

router = APIRouter(prefix="/announcements", tags=["announcements"])


def _serialize(announcement: Announcement, creator: Profile | None) -> dict[str, Any]:
    return {
        "id": str(announcement.id),
        "title": announcement.title,
        "body": announcement.body,
        "priority": announcement.priority,
        "created_by": str(announcement.created_by) if announcement.created_by else None,
        "read_by": [str(uid) for uid in (announcement.read_by or [])],
        "created_at": announcement.created_at.isoformat(),
        "creator": (
            {"name": creator.name, "avatar": creator.avatar} if creator else None
        ),
    }


@router.get("")
def list_announcements(db: Session = Depends(get_db), _user: Profile = Depends(get_current_user)) -> list[dict[str, Any]]:
    rows = db.scalars(select(Announcement).order_by(Announcement.created_at.desc())).all()
    creator_ids = {row.created_by for row in rows if row.created_by}
    creators = {
        creator.id: creator
        for creator in db.scalars(select(Profile).where(Profile.id.in_(creator_ids))).all()
    }
    return [_serialize(row, creators.get(row.created_by)) for row in rows]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_announcement(
    payload: AnnouncementCreate,
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> dict[str, Any]:
    if Role(user.role) not in {Role.OWNER, Role.MANAGER}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owner/manager can post")
    announcement = Announcement(**payload.model_dump(), created_by=user.id)
    db.add(announcement)
    users = db.scalars(select(Profile).where(Profile.is_active.is_(True))).all()
    for target in users:
        db.add(
            Notification(
                user_id=target.id,
                message=f"New announcement: {announcement.title}",
                type="announcement",
                link="/announcements",
            )
        )
    db.commit()
    db.refresh(announcement)
    return _serialize(announcement, user)


@router.patch("/{announcement_id}/read")
def mark_read(
    announcement_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> dict[str, Any]:
    announcement = db.get(Announcement, announcement_id)
    if not announcement:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found")
    if user.id not in (announcement.read_by or []):
        announcement.read_by = [*(announcement.read_by or []), user.id]
        db.commit()
        db.refresh(announcement)
    return _serialize(announcement, None)
