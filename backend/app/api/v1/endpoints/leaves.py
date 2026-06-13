"""Leave management with the joined `user` shape the demo UI expects."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.core.roles import Role
from app.db.session import get_db
from app.models.leave import LeaveRequest
from app.models.notification import Notification
from app.models.profile import Profile
from app.schemas.leave import LeaveBalance, LeaveCreate, LeaveDecision
from app.utils.queues import DASHBOARD_CACHE

router = APIRouter(prefix="/leaves", tags=["leaves"])


def _serialize(leave: LeaveRequest, profile: Profile | None) -> dict[str, Any]:
    return {
        "id": str(leave.id),
        "user_id": str(leave.user_id),
        "leave_type": leave.leave_type,
        "start_date": leave.start_date.isoformat(),
        "end_date": leave.end_date.isoformat(),
        "days": leave.days,
        "reason": leave.reason,
        "status": leave.status,
        "rejection_reason": leave.rejection_reason,
        "reviewed_by": str(leave.reviewed_by) if leave.reviewed_by else None,
        "reviewed_at": leave.reviewed_at.isoformat() if leave.reviewed_at else None,
        "created_at": leave.created_at.isoformat(),
        "user": (
            {
                "id": str(profile.id),
                "name": profile.name,
                "avatar": profile.avatar,
                "designation": profile.designation,
                "leaves_total": profile.leaves_total,
                "leaves_taken": profile.leaves_taken,
            }
            if profile
            else None
        ),
    }


@router.get("/balance", response_model=LeaveBalance)
def leave_balance(user: Profile = Depends(get_current_user)) -> LeaveBalance:
    return LeaveBalance(
        total=user.leaves_total,
        taken=user.leaves_taken,
        remaining=max(user.leaves_total - user.leaves_taken, 0),
    )


@router.get("")
def list_leaves(
    user_id: uuid.UUID | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> list[dict[str, Any]]:
    target_user_id = user_id or user.id
    role = Role(user.role)
    visible_all = role in {Role.OWNER, Role.MANAGER, Role.HR}
    if target_user_id != user.id and not visible_all:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot view other leaves")
    stmt = select(LeaveRequest)
    if not visible_all or user_id:
        stmt = stmt.where(LeaveRequest.user_id == target_user_id)
    if status_filter:
        stmt = stmt.where(LeaveRequest.status == status_filter)
    leaves = db.scalars(stmt.order_by(LeaveRequest.created_at.desc())).all()
    profile_ids = {leave.user_id for leave in leaves}
    profiles = {
        profile.id: profile
        for profile in db.scalars(select(Profile).where(Profile.id.in_(profile_ids))).all()
    }
    return [_serialize(leave, profiles.get(leave.user_id)) for leave in leaves]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_leave(
    payload: LeaveCreate,
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> dict[str, Any]:
    days = (payload.end_date - payload.start_date).days + 1
    leave = LeaveRequest(user_id=user.id, days=days, **payload.model_dump())
    db.add(leave)
    db.commit()
    db.refresh(leave)
    admins = db.scalars(select(Profile).where(Profile.role.in_(["owner", "hr"]))).all()
    for admin in admins:
        db.add(
            Notification(
                user_id=admin.id,
                message=f"{user.name} submitted a {payload.leave_type} leave request",
                type="leave",
                link="/leave",
            )
        )
    db.commit()
    DASHBOARD_CACHE.invalidate()
    return _serialize(leave, user)


@router.patch("/{leave_id}")
def decide_leave(
    leave_id: uuid.UUID,
    payload: LeaveDecision,
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> dict[str, Any]:
    if Role(user.role) not in {Role.OWNER, Role.HR}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only HR/owner can decide leaves")
    if payload.status not in {"Approved", "Rejected"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Status must be Approved or Rejected")
    leave = db.get(LeaveRequest, leave_id)
    if not leave:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave not found")
    if leave.status != "Pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Leave already decided")
    leave.status = payload.status
    leave.rejection_reason = payload.rejection_reason
    leave.reviewed_by = user.id
    leave.reviewed_at = datetime.now(timezone.utc)
    applicant = db.get(Profile, leave.user_id)
    if applicant and payload.status == "Approved":
        applicant.leaves_taken += leave.days
    if applicant:
        db.add(
            Notification(
                user_id=applicant.id,
                message=f"Your {leave.leave_type} leave has been {payload.status.lower()}",
                type="leave",
                link="/leave",
            )
        )
    db.commit()
    db.refresh(leave)
    DASHBOARD_CACHE.invalidate()
    return _serialize(leave, applicant)
