"""Billing and accounting — returns task rows with brand joins."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.api.v1.endpoints.tasks import _brand_map, _serialize
from app.core.roles import Role, can_set_price
from app.db.session import get_db
from app.models.profile import Profile
from app.models.task import Task
from app.schemas.billing import BillingSummary, MarkBilledRequest, SetPriceRequest
from app.utils.queues import DASHBOARD_CACHE

router = APIRouter(prefix="/billing", tags=["billing"])


def _require_billing_view(user: Profile) -> None:
    if Role(user.role) not in {Role.OWNER, Role.MANAGER, Role.ACCOUNTANT}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Billing restricted")


def _require_billing_edit(user: Profile) -> None:
    if Role(user.role) not in {Role.OWNER, Role.ACCOUNTANT}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owner/accountant can mark billed")


def _require_price_edit(user: Profile) -> None:
    if not can_set_price(Role(user.role)):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot set task price")


@router.get("/summary", response_model=BillingSummary)
def summary(db: Session = Depends(get_db), user: Profile = Depends(get_current_user)) -> BillingSummary:
    _require_billing_view(user)
    role = Role(user.role)
    tasks = db.scalars(select(Task).where(Task.is_billable.is_(True))).all()
    unpriced = sum(1 for task in tasks if not task.billable_amount)
    billed_tasks = [task for task in tasks if task.billed_at]
    pending_tasks = [task for task in tasks if not task.billed_at]
    total = sum((Decimal(task.billable_amount or 0) for task in tasks), Decimal("0"))
    billed = sum((Decimal(task.billable_amount or 0) for task in billed_tasks), Decimal("0"))

    if role is Role.MANAGER:
        return BillingSummary(
            total_billable=total,
            pending=total - billed,
            billed=billed,
            unpriced=unpriced,
            pending_count=len(pending_tasks),
            billed_count=len(billed_tasks),
            total_count=len(tasks),
        )

    return BillingSummary(
        total_billable=total,
        pending=total - billed,
        billed=billed,
        unpriced=unpriced,
        pending_count=len(pending_tasks),
        billed_count=len(billed_tasks),
        total_count=len(tasks),
    )


@router.get("")
def list_billable(
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> list[dict[str, Any]]:
    _require_billing_view(user)
    tasks = db.scalars(
        select(Task).where(Task.is_billable.is_(True)).order_by(Task.created_at.desc())
    ).all()
    brands = _brand_map(db, [task.brand_id for task in tasks if task.brand_id])
    return [_serialize(task, brands, role=Role(user.role)) for task in tasks]


@router.post("/{task_id}/price")
def set_price(
    task_id: uuid.UUID,
    payload: SetPriceRequest,
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> dict[str, Any]:
    _require_price_edit(user)
    task = db.get(Task, task_id)
    if not task or not task.is_billable:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Billable task not found")
    task.billable_amount = payload.amount
    db.commit()
    db.refresh(task)
    DASHBOARD_CACHE.invalidate()
    brands = _brand_map(db, [task.brand_id] if task.brand_id else [])
    return _serialize(task, brands, role=Role(user.role))


@router.post("/{task_id}/mark-billed")
def mark_billed(
    task_id: uuid.UUID,
    payload: MarkBilledRequest | None = None,
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> dict[str, Any]:
    _require_billing_edit(user)
    task = db.get(Task, task_id)
    if not task or not task.is_billable:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Billable task not found")
    if not task.billable_amount:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Set price before marking billed")
    billed = True if payload is None else payload.billed
    task.billed_at = datetime.now(timezone.utc) if billed else None
    db.commit()
    db.refresh(task)
    DASHBOARD_CACHE.invalidate()
    brands = _brand_map(db, [task.brand_id] if task.brand_id else [])
    return _serialize(task, brands, role=Role(user.role))
