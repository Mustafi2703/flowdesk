"""Tasks, sub-tasks, developer board, and task chat.

The endpoints here intentionally return the same flat-with-joined-objects
shape the demo frontend (Next.js) expects, so we don't need a separate DTO
layer in the UI.
"""

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
from app.models.brand import Brand
from app.models.notification import Notification
from app.models.profile import Profile
from app.models.task import Task, TaskChat
from app.schemas.task import TaskChatSend, TaskCreate, TaskStatusUpdate, TaskUpdate
from app.utils.queues import DASHBOARD_CACHE

router = APIRouter(prefix="/tasks", tags=["tasks"])
dev_router = APIRouter(prefix="/dev-board", tags=["developer-board"])


def _serialize(task: Task, brand_map: dict[uuid.UUID, Brand] | None = None, *, role: Role | None = None) -> dict[str, Any]:
    """Match the joined shape the demo frontend expects."""
    brand = (brand_map or {}).get(task.brand_id) if task.brand_id else None
    payload: dict[str, Any] = {
        "id": str(task.id),
        "title": task.title,
        "description": task.description,
        "brand_id": str(task.brand_id) if task.brand_id else None,
        "assigned_to": [str(uid) for uid in (task.assigned_to or [])],
        "assigned_managers": [str(uid) for uid in (task.assigned_managers or [])],
        "created_by": str(task.created_by) if task.created_by else None,
        "type": task.type,
        "task_mode": task.task_mode,
        "priority": task.priority,
        "status": task.status,
        "start_date": task.start_date.isoformat() if task.start_date else None,
        "due_date": task.due_date.isoformat() if task.due_date else None,
        "requires_review": task.requires_review,
        "is_billable": task.is_billable,
        "billable_amount": float(task.billable_amount) if task.billable_amount is not None else None,
        "has_price": task.billable_amount is not None,
        "billed_at": task.billed_at.isoformat() if task.billed_at else None,
        "checklist": task.checklist or [],
        "sub_tasks": task.sub_tasks or [],
        "recurring_config": task.recurring_config,
        "created_at": task.created_at.isoformat(),
        "updated_at": task.updated_at.isoformat(),
        "brand": (
            {"id": str(brand.id), "name": brand.name, "logo": brand.logo}
            if brand is not None
            else None
        ),
    }
    # Hide billing data from non-finance roles.
    if role in {Role.TEAM, Role.DEVELOPER, Role.HR}:
        payload["is_billable"] = False
        payload["billable_amount"] = None
        payload["has_price"] = False
        payload["billed_at"] = None
    return payload


def _is_assignee(task: Task, user: Profile) -> bool:
    if user.id in (task.assigned_to or []):
        return True
    me = str(user.id)
    return any(me in {str(x) for x in (st.get("assigned_to") or [])} for st in (task.sub_tasks or []))


def _is_parent_assignee(task: Task, user: Profile) -> bool:
    return user.id in (task.assigned_to or [])


def _can_set_price(role: Role) -> bool:
    return role in {Role.OWNER, Role.MANAGER, Role.ACCOUNTANT}


def _validate_sub_task_patch(old_subs: list[dict], new_subs: list[dict], user: Profile) -> None:
    old_map = {st.get("id"): st for st in old_subs if st.get("id")}
    me = str(user.id)
    for st in new_subs:
        sid = st.get("id")
        if not sid or sid not in old_map:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot add or remove sub-tasks")
        old_st = old_map[sid]
        if st == old_st:
            continue
        if me not in {str(x) for x in (old_st.get("assigned_to") or [])}:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not assigned to this sub-task")
        for key, value in st.items():
            if key == "status":
                continue
            if old_st.get(key) != value:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot edit sub-task metadata")


def _can_view(task: Task, user: Profile) -> bool:
    role = Role(user.role)
    if role in {Role.OWNER, Role.MANAGER, Role.HR, Role.ACCOUNTANT}:
        return True
    if user.id in (task.assigned_to or []):
        return True
    me = str(user.id)
    return any(me in {str(x) for x in (st.get("assigned_to") or [])} for st in (task.sub_tasks or []))


def _brand_map(db: Session, brand_ids: list[uuid.UUID]) -> dict[uuid.UUID, Brand]:
    ids = [bid for bid in brand_ids if bid]
    if not ids:
        return {}
    rows = db.scalars(select(Brand).where(Brand.id.in_(set(ids)))).all()
    return {brand.id: brand for brand in rows}


@router.get("")
def list_tasks(
    brand_id: uuid.UUID | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> list[dict[str, Any]]:
    stmt = select(Task).order_by(Task.created_at.desc())
    if brand_id:
        stmt = stmt.where(Task.brand_id == brand_id)
    if status_filter:
        stmt = stmt.where(Task.status == status_filter)
    tasks = db.scalars(stmt).all()
    visible = [task for task in tasks if _can_view(task, user)]
    brands = _brand_map(db, [task.brand_id for task in visible if task.brand_id])
    role = Role(user.role)
    return [_serialize(task, brands, role=role) for task in visible]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_task(
    payload: TaskCreate,
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> dict[str, Any]:
    if Role(user.role) not in {Role.OWNER, Role.MANAGER}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owner/manager can create tasks")
    role = Role(user.role)
    data = payload.model_dump(mode="json")
    if data.get("billable_amount") is not None and not _can_set_price(role):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot set task price")
    if not data.get("is_billable"):
        data["billable_amount"] = None
    data.setdefault("status", "Not Started")
    for key in ("assigned_to", "assigned_managers", "brand_id"):
        if data.get(key):
            if key == "brand_id":
                data[key] = uuid.UUID(str(data[key]))
            else:
                data[key] = [uuid.UUID(str(v)) for v in data[key]]
    task = Task(
        **data,
        created_by=user.id,
        timeline=[
            {
                "by": str(user.id),
                "action": "Created task",
                "at": datetime.now(timezone.utc).isoformat(),
            }
        ],
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    for assignee_id in task.assigned_to or []:
        db.add(
            Notification(
                user_id=assignee_id,
                message=f'Task "{task.title}" assigned to you',
                type="task",
                link=f"/tasks/{task.id}",
            )
        )
    db.commit()
    DASHBOARD_CACHE.invalidate()
    brands = _brand_map(db, [task.brand_id] if task.brand_id else [])
    return _serialize(task, brands, role=Role(user.role))


@router.get("/{task_id}")
def get_task(
    task_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> dict[str, Any]:
    task = db.get(Task, task_id)
    if not task or not _can_view(task, user):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    brands = _brand_map(db, [task.brand_id] if task.brand_id else [])
    return _serialize(task, brands, role=Role(user.role))


@router.patch("/{task_id}")
def update_task(
    task_id: uuid.UUID,
    payload: TaskUpdate,
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> dict[str, Any]:
    task = db.get(Task, task_id)
    if not task or not _can_view(task, user):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    role = Role(user.role)
    allowed_manager = role in {Role.OWNER, Role.MANAGER}
    fields = set(payload.model_fields_set)
    if not allowed_manager:
        if not _is_assignee(task, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not assigned to this task")
        if fields == {"status"}:
            if not _is_parent_assignee(task, user):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only parent assignees can update task status")
        elif fields == {"sub_tasks"}:
            _validate_sub_task_patch(task.sub_tasks or [], payload.sub_tasks or [], user)
        else:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot edit task metadata")
    if "billable_amount" in fields and not _can_set_price(role):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot set task price")
    update = payload.model_dump(exclude_unset=True, mode="json")
    if update.get("is_billable") is False:
        update["billable_amount"] = None
    for key, value in update.items():
        setattr(task, key, value)
    task.timeline = [
        *(task.timeline or []),
        {
            "by": str(user.id),
            "action": "Updated task",
            "fields": list(update.keys()),
            "at": datetime.now(timezone.utc).isoformat(),
        },
    ]
    db.commit()
    db.refresh(task)
    if task.status in {"Struggling", "Needs Attention"}:
        for manager_id in task.assigned_managers or []:
            db.add(
                Notification(
                    user_id=manager_id,
                    message=f'Task "{task.title}" flagged as {task.status}',
                    type="task",
                    link=f"/tasks/{task.id}",
                )
            )
        db.commit()
    DASHBOARD_CACHE.invalidate()
    brands = _brand_map(db, [task.brand_id] if task.brand_id else [])
    return _serialize(task, brands, role=role)


@router.post("/{task_id}/status")
def change_status(
    task_id: uuid.UUID,
    payload: TaskStatusUpdate,
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> dict[str, Any]:
    return update_task(task_id, TaskUpdate(status=payload.status), db=db, user=user)


@router.delete("/{task_id}")
def delete_task(
    task_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> dict[str, bool]:
    if Role(user.role) not in {Role.OWNER, Role.MANAGER}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owner or manager can delete tasks")
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    db.delete(task)
    db.commit()
    DASHBOARD_CACHE.invalidate()
    return {"ok": True}


@router.get("/{task_id}/chats")
def list_chats(
    task_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> list[dict[str, Any]]:
    task = db.get(Task, task_id)
    if not task or not _can_view(task, user):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    chats = db.scalars(
        select(TaskChat).where(TaskChat.task_id == task_id).order_by(TaskChat.created_at)
    ).all()
    sender_ids = {chat.sender_id for chat in chats}
    senders = {
        sender.id: sender
        for sender in db.scalars(select(Profile).where(Profile.id.in_(sender_ids))).all()
    }
    out: list[dict[str, Any]] = []
    for chat in chats:
        sender = senders.get(chat.sender_id)
        out.append(
            {
                "id": str(chat.id),
                "task_id": str(chat.task_id),
                "sender_id": str(chat.sender_id),
                "message": chat.message,
                "type": chat.type,
                "voice_url": chat.voice_url,
                "duration": chat.duration,
                "created_at": chat.created_at.isoformat(),
                "sender": (
                    {
                        "id": str(sender.id),
                        "name": sender.name,
                        "avatar": sender.avatar,
                        "role": sender.role,
                    }
                    if sender
                    else None
                ),
            }
        )
    return out


@router.post("/{task_id}/chats", status_code=status.HTTP_201_CREATED)
def send_chat(
    task_id: uuid.UUID,
    payload: TaskChatSend,
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> dict[str, Any]:
    task = db.get(Task, task_id)
    if not task or not _can_view(task, user):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    chat = TaskChat(task_id=task_id, sender_id=user.id, **payload.model_dump())
    db.add(chat)
    db.commit()
    db.refresh(chat)
    recipients = {
        *(task.assigned_to or []),
        *(task.assigned_managers or []),
    } - {user.id}
    for recipient in recipients:
        db.add(
            Notification(
                user_id=recipient,
                message=f'{user.name} sent a message in "{task.title}"',
                type="chat",
                link=f"/tasks/{task.id}",
            )
        )
    db.commit()
    return {
        "id": str(chat.id),
        "task_id": str(chat.task_id),
        "sender_id": str(chat.sender_id),
        "message": chat.message,
        "type": chat.type,
        "voice_url": chat.voice_url,
        "duration": chat.duration,
        "created_at": chat.created_at.isoformat(),
        "sender": {
            "id": str(user.id),
            "name": user.name,
            "avatar": user.avatar,
            "role": user.role,
        },
    }


@dev_router.get("")
def developer_board(
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> list[dict[str, Any]]:
    tasks = db.scalars(select(Task).order_by(Task.due_date.nulls_last())).all()
    role = Role(user.role)
    visible: list[Task] = []
    for task in tasks:
        is_dev = task.type == "Development" or task.task_mode == "project"
        if not is_dev:
            continue
        if role in {Role.OWNER, Role.MANAGER} or _can_view(task, user):
            visible.append(task)
    brands = _brand_map(db, [task.brand_id for task in visible if task.brand_id])
    return [_serialize(task, brands, role=role) for task in visible]
