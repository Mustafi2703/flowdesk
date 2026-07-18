"""Brands management — returns flat objects with assigned member info."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.core.roles import Role
from app.db.session import get_db
from app.models.brand import Brand
from app.models.profile import Profile
from app.schemas.brand import BrandCreate, BrandUpdate
from app.utils.queues import DASHBOARD_CACHE

router = APIRouter(prefix="/brands", tags=["brands"])


def _serialize(brand: Brand) -> dict[str, Any]:
    return {
        "id": str(brand.id),
        "name": brand.name,
        "logo": brand.logo,
        "description": brand.description,
        "client_type": brand.client_type,
        "priority": brand.priority,
        "short_term_goals": list(brand.short_term_goals or []),
        "long_term_goals": list(brand.long_term_goals or []),
        "journey": list(brand.journey or []),
        "responsibilities": brand.responsibilities,
        "assigned_members": [str(uid) for uid in (brand.assigned_members or [])],
        "created_by": str(brand.created_by) if brand.created_by else None,
        "created_at": brand.created_at.isoformat(),
        "updated_at": brand.updated_at.isoformat(),
    }


def _can_view(brand: Brand, user: Profile) -> bool:
    if Role(user.role) in {Role.OWNER, Role.MANAGER, Role.HR, Role.ACCOUNTANT}:
        return True
    return user.id in (brand.assigned_members or [])


@router.get("")
def list_brands(db: Session = Depends(get_db), user: Profile = Depends(get_current_user)) -> list[dict[str, Any]]:
    brands = db.scalars(select(Brand).order_by(Brand.name)).all()
    return [_serialize(brand) for brand in brands if _can_view(brand, user)]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_brand(
    payload: BrandCreate,
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> dict[str, Any]:
    if Role(user.role) not in {Role.OWNER, Role.MANAGER}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owner/manager can create brands")
    brand = Brand(**payload.model_dump(), created_by=user.id)
    db.add(brand)
    db.commit()
    db.refresh(brand)
    DASHBOARD_CACHE.invalidate()
    return _serialize(brand)


@router.get("/{brand_id}")
def get_brand(
    brand_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> dict[str, Any]:
    brand = db.get(Brand, brand_id)
    if not brand or not _can_view(brand, user):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Brand not found")
    return _serialize(brand)


@router.patch("/{brand_id}")
def update_brand(
    brand_id: uuid.UUID,
    payload: BrandUpdate,
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> dict[str, Any]:
    if Role(user.role) not in {Role.OWNER, Role.MANAGER}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owner/manager can edit brands")
    brand = db.get(Brand, brand_id)
    if not brand:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Brand not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(brand, key, value)
    db.commit()
    db.refresh(brand)
    DASHBOARD_CACHE.invalidate()
    return _serialize(brand)
