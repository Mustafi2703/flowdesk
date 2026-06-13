"""Attendance — daily clock-in/out, formatted for the demo UI."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.core.roles import Role
from app.db.session import get_db
from app.models.attendance import AttendanceLog
from app.models.profile import Profile
from app.utils.queues import DASHBOARD_CACHE

router = APIRouter(prefix="/attendance", tags=["attendance"])

_IST = timezone(timedelta(hours=5, minutes=30))


def _now_ist() -> datetime:
    return datetime.now(_IST)


def _serialize(log: AttendanceLog) -> dict[str, Any]:
    return {
        "id": str(log.id),
        "user_id": str(log.user_id),
        "date": log.date.isoformat(),
        "login_time": log.login_time.astimezone(_IST).strftime("%H:%M") if log.login_time else None,
        "logout_time": log.logout_time.astimezone(_IST).strftime("%H:%M") if log.logout_time else None,
        "hours_worked": float(log.hours_worked) if log.hours_worked is not None else 0.0,
        "notes": log.notes,
    }


@router.get("")
def list_attendance(
    user_id: uuid.UUID | None = Query(default=None),
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> list[dict[str, Any]]:
    target_user_id = user_id or user.id
    if target_user_id != user.id and Role(user.role) not in {Role.OWNER, Role.MANAGER, Role.HR}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot view other attendance")
    rows = db.scalars(
        select(AttendanceLog)
        .where(AttendanceLog.user_id == target_user_id)
        .order_by(AttendanceLog.date.desc())
        .limit(90)
    ).all()
    return [_serialize(row) for row in rows]


@router.post("/clockin")
@router.post("/clock-in")
def clock_in(db: Session = Depends(get_db), user: Profile = Depends(get_current_user)) -> dict[str, Any]:
    now = _now_ist()
    log = db.scalar(
        select(AttendanceLog).where(
            AttendanceLog.user_id == user.id, AttendanceLog.date == now.date()
        )
    )
    if log:
        log.login_time = now
        log.logout_time = None
        log.hours_worked = 0
    else:
        log = AttendanceLog(user_id=user.id, date=now.date(), login_time=now)
        db.add(log)
    db.commit()
    db.refresh(log)
    DASHBOARD_CACHE.invalidate()
    return _serialize(log)


@router.post("/clockout")
@router.post("/clock-out")
def clock_out(db: Session = Depends(get_db), user: Profile = Depends(get_current_user)) -> dict[str, Any]:
    now = _now_ist()
    log = db.scalar(
        select(AttendanceLog).where(
            AttendanceLog.user_id == user.id, AttendanceLog.date == now.date()
        )
    )
    if not log or not log.login_time:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Clock in first")
    log.logout_time = now
    minutes = (log.logout_time - log.login_time).total_seconds() / 60
    log.hours_worked = round(minutes / 60, 2)
    db.commit()
    db.refresh(log)
    DASHBOARD_CACHE.invalidate()
    return _serialize(log)
