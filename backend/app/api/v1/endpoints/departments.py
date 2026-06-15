"""Department management — org units with assigned managers."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.core.roles import Role
from app.db.session import get_db
from app.models.department import Department
from app.models.profile import Profile
from app.schemas.department import DepartmentCreate, DepartmentOut, DepartmentUpdate

router = APIRouter(prefix="/departments", tags=["departments"])

_MANAGEMENT_ROLES = frozenset({Role.OWNER, Role.MANAGER})


def _require_department_view(user: Profile) -> None:
    if Role(user.role) not in {Role.OWNER, Role.MANAGER, Role.HR}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Department access restricted")


def _validate_manager(db: Session, manager_id: uuid.UUID | None) -> uuid.UUID | None:
    if manager_id is None:
        return None
    manager = db.get(Profile, manager_id)
    if not manager or not manager.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid manager")
    if Role(manager.role) not in _MANAGEMENT_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Department manager must be an owner or manager account",
        )
    return manager.id


def _serialize_department(db: Session, dept: Department) -> dict[str, Any]:
    manager = db.get(Profile, dept.manager_id) if dept.manager_id else None
    member_count = db.scalar(
        select(func.count(Profile.id)).where(
            Profile.is_active.is_(True),
            func.lower(Profile.department) == dept.name.lower(),
        )
    )
    return DepartmentOut(
        id=dept.id,
        name=dept.name,
        description=dept.description,
        manager_id=dept.manager_id,
        manager=(
            {
                "id": manager.id,
                "name": manager.name,
                "role": manager.role,
                "email": manager.email,
            }
            if manager
            else None
        ),
        member_count=int(member_count or 0),
        created_at=dept.created_at,
    ).model_dump()


def _department_query_for(user: Profile):
    stmt = select(Department).order_by(Department.name)
    if Role(user.role) is Role.MANAGER:
        stmt = stmt.where(Department.manager_id == user.id)
    return stmt


@router.get("", response_model=list[DepartmentOut])
def list_departments(
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> list[dict[str, Any]]:
    _require_department_view(user)
    rows = db.scalars(_department_query_for(user)).all()
    return [_serialize_department(db, dept) for dept in rows]


@router.post("", response_model=DepartmentOut, status_code=status.HTTP_201_CREATED)
def create_department(
    payload: DepartmentCreate,
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> dict[str, Any]:
    if Role(user.role) is not Role.OWNER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owner can create departments")
    name = payload.name.strip()
    if db.scalar(select(Department).where(func.lower(Department.name) == name.lower())):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Department name already exists")
    manager_id = _validate_manager(db, payload.manager_id)
    dept = Department(
        name=name,
        description=(payload.description or "").strip() or None,
        manager_id=manager_id,
        created_by=user.id,
    )
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return _serialize_department(db, dept)


@router.patch("/{department_id}", response_model=DepartmentOut)
def update_department(
    department_id: uuid.UUID,
    payload: DepartmentUpdate,
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> dict[str, Any]:
    if Role(user.role) is not Role.OWNER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owner can edit departments")
    dept = db.get(Department, department_id)
    if not dept:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")
    incoming = payload.model_dump(exclude_unset=True)
    old_name = dept.name
    if "name" in incoming and incoming["name"]:
        new_name = incoming["name"].strip()
        clash = db.scalar(
            select(Department).where(
                func.lower(Department.name) == new_name.lower(),
                Department.id != dept.id,
            )
        )
        if clash:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Department name already exists")
        dept.name = new_name
    if "description" in incoming:
        dept.description = (incoming["description"] or "").strip() or None
    if "manager_id" in incoming:
        dept.manager_id = _validate_manager(db, incoming["manager_id"])
    db.commit()
    db.refresh(dept)
    if dept.name != old_name:
        for profile in db.scalars(
            select(Profile).where(func.lower(Profile.department) == old_name.lower())
        ).all():
            profile.department = dept.name
        db.commit()
    return _serialize_department(db, dept)


@router.delete("/{department_id}")
def delete_department(
    department_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> dict[str, bool]:
    if Role(user.role) is not Role.OWNER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owner can delete departments")
    dept = db.get(Department, department_id)
    if not dept:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")
    db.delete(dept)
    db.commit()
    return {"ok": True}
