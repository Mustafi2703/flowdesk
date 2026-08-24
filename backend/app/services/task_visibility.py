"""Shared task visibility rules — keep dashboard, tasks list, and updates aligned."""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.core.roles import Role
from app.models.brand import Brand
from app.models.profile import Profile
from app.models.task import Task


def is_task_assignee(task: Task, user: Profile) -> bool:
    if user.id in (task.assigned_to or []):
        return True
    me = str(user.id)
    for st in task.sub_tasks or []:
        if me in {str(x) for x in (st.get("assigned_to") or [])}:
            return True
    return False


def can_view_task(task: Task, user: Profile, brand: Brand | None = None) -> bool:
    role = Role(user.role)
    if role in {Role.OWNER, Role.MANAGER, Role.HR, Role.ACCOUNTANT}:
        return True
    if is_task_assignee(task, user):
        return True
    if brand is not None and (
        str(user.id) in {str(x) for x in (brand.assigned_members or [])}
        or str(user.id) in {str(x) for x in (getattr(brand, "assigned_managers", None) or [])}
    ):
        return True
    return False


def resolve_brand(db: Session, task: Task, cache: dict[uuid.UUID, Brand] | None = None) -> Brand | None:
    if not task.brand_id:
        return None
    if cache is not None and task.brand_id in cache:
        return cache[task.brand_id]
    brand = db.get(Brand, task.brand_id)
    if brand is not None and cache is not None:
        cache[task.brand_id] = brand
    return brand


def can_view_task_db(db: Session, task: Task, user: Profile) -> bool:
    return can_view_task(task, user, resolve_brand(db, task))
