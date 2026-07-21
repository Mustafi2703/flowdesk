"""Tasks, sub-tasks, developer board, and task chat.

The endpoints here intentionally return the same flat-with-joined-objects
shape the demo frontend (Next.js) expects, so we don't need a separate DTO
layer in the UI.
"""

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
from app.models.brand import Brand
from app.models.notification import Notification
from app.models.profile import Profile
from app.models.task import Task, TaskChat
from app.schemas.task import TaskChatSend, TaskCreate, TaskStatusUpdate, TaskUpdate
from app.utils.queues import DASHBOARD_CACHE

router = APIRouter(prefix="/tasks", tags=["tasks"])
dev_router = APIRouter(prefix="/dev-board", tags=["developer-board"])

_IST = timezone(timedelta(hours=5, minutes=30))
_ASSIGNEE_PROGRESS_FIELDS = frozenset({"status", "checklist", "sub_tasks", "description"})


def _serialize(
    task: Task,
    brand_map: dict[uuid.UUID, Brand] | None = None,
    *,
    role: Role | None = None,
    creators: dict[uuid.UUID, Profile] | None = None,
    assigners: dict[uuid.UUID, Profile] | None = None,
) -> dict[str, Any]:
    """Match the joined shape the demo frontend expects."""
    brand = (brand_map or {}).get(task.brand_id) if task.brand_id else None
    assigner_id = task.assigned_by or task.created_by
    assigner = None
    if assigner_id:
        assigner = (assigners or {}).get(assigner_id) or (creators or {}).get(assigner_id)
    payload: dict[str, Any] = {
        "id": str(task.id),
        "title": task.title,
        "description": task.description,
        "brand_id": str(task.brand_id) if task.brand_id else None,
        "assigned_to": [str(uid) for uid in (task.assigned_to or [])],
        "assigned_managers": [str(uid) for uid in (task.assigned_managers or [])],
        "created_by": str(task.created_by) if task.created_by else None,
        "assigned_by_id": str(task.assigned_by) if task.assigned_by else (str(task.created_by) if task.created_by else None),
        "assigned_by": (
            {
                "id": str(assigner.id),
                "name": assigner.name,
                "avatar": assigner.avatar,
                "role": assigner.role,
            }
            if assigner
            else None
        ),
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
        "updates_closed": bool(getattr(task, "updates_closed", False)),
        "updates_closed_at": task.updates_closed_at.isoformat() if getattr(task, "updates_closed_at", None) else None,
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
    # Managers see billable flag + priced status, but never the amount.
    elif role is Role.MANAGER:
        payload["billable_amount"] = None
    return payload


def _people_map(db: Session, *id_lists: list[uuid.UUID | None]) -> dict[uuid.UUID, Profile]:
    ids: set[uuid.UUID] = set()
    for lst in id_lists:
        for x in lst:
            if x:
                ids.add(x)
    if not ids:
        return {}
    return {p.id: p for p in db.scalars(select(Profile).where(Profile.id.in_(ids))).all()}


def _is_assignee(task: Task, user: Profile) -> bool:
    if str(user.id) in {str(x) for x in (task.assigned_to or [])}:
        return True
    me = str(user.id)
    return any(me in {str(x) for x in (st.get("assigned_to") or [])} for st in (task.sub_tasks or []))


def _is_parent_assignee(task: Task, user: Profile) -> bool:
    return str(user.id) in {str(x) for x in (task.assigned_to or [])}


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


def _can_set_price(role: Role) -> bool:
    return role in {Role.OWNER, Role.ACCOUNTANT}


def _is_clocked_in_today(db: Session, user: Profile) -> bool:
    today = datetime.now(_IST).date()
    log = db.scalar(
        select(AttendanceLog).where(
            AttendanceLog.user_id == user.id,
            AttendanceLog.date == today,
        )
    )
    return log is not None and log.login_time is not None and log.logout_time is None


def _can_view(task: Task, user: Profile, brand: Brand | None = None) -> bool:
    role = Role(user.role)
    if role in {Role.OWNER, Role.MANAGER, Role.HR, Role.ACCOUNTANT}:
        return True
    if _is_assignee(task, user):
        return True
    # Brand-allocated people can open that brand's tasks (Updates + docs).
    if brand is not None and (
        str(user.id) in {str(x) for x in (brand.assigned_members or [])}
        or str(user.id) in {str(x) for x in (getattr(brand, "assigned_managers", None) or [])}
    ):
        return True
    return False


def _creator_map(db: Session, tasks: list[Task]) -> dict[uuid.UUID, Profile]:
    ids = [t.created_by for t in tasks if t.created_by]
    if not ids:
        return {}
    return {p.id: p for p in db.scalars(select(Profile).where(Profile.id.in_(set(ids)))).all()}


def _brand_map(db: Session, brand_ids: list[uuid.UUID]) -> dict[uuid.UUID, Brand]:
    ids = [bid for bid in brand_ids if bid]
    if not ids:
        return {}
    rows = db.scalars(select(Brand).where(Brand.id.in_(set(ids)))).all()
    return {brand.id: brand for brand in rows}


def _resolve_brand(db: Session, task: Task, cache: dict[uuid.UUID, Brand] | None = None) -> Brand | None:
    if not task.brand_id:
        return None
    if cache is not None and task.brand_id in cache:
        return cache[task.brand_id]
    brand = db.get(Brand, task.brand_id)
    if brand is not None and cache is not None:
        cache[task.brand_id] = brand
    return brand


def _can_view_db(db: Session, task: Task, user: Profile) -> bool:
    return _can_view(task, user, _resolve_brand(db, task))


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
    brands = _brand_map(db, [task.brand_id for task in tasks if task.brand_id])
    visible = [
        task
        for task in tasks
        if _can_view(task, user, brands.get(task.brand_id) if task.brand_id else None)
    ]
    creator_ids = [task.created_by for task in visible if task.created_by]
    assigner_ids = [task.assigned_by for task in visible if task.assigned_by]
    people = _people_map(db, creator_ids, assigner_ids)
    role = Role(user.role)
    return [_serialize(task, brands, role=role, creators=people, assigners=people) for task in visible]


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
        assigned_by=user.id,
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
                message=f'Task "{task.title}" assigned to you by {user.name}',
                type="task",
                link="/tasks",
            )
        )
    db.commit()
    DASHBOARD_CACHE.invalidate()
    brands = _brand_map(db, [task.brand_id] if task.brand_id else [])
    people = _people_map(db, [task.created_by, task.assigned_by])
    return _serialize(task, brands, role=Role(user.role), creators=people, assigners=people)


@router.get("/{task_id}")
def get_task(
    task_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> dict[str, Any]:
    task = db.get(Task, task_id)
    if not task or not _can_view_db(db, task, user):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    brands = _brand_map(db, [task.brand_id] if task.brand_id else [])
    people = _people_map(db, [task.created_by, task.assigned_by])
    return _serialize(task, brands, role=Role(user.role), creators=people, assigners=people)


@router.patch("/{task_id}")
def update_task(
    task_id: uuid.UUID,
    payload: TaskUpdate,
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> dict[str, Any]:
    task = db.get(Task, task_id)
    if not task or not _can_view_db(db, task, user):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    role = Role(user.role)
    allowed_manager = role in {Role.OWNER, Role.MANAGER}
    fields = set(payload.model_fields_set)
    if not allowed_manager:
        if not _is_assignee(task, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not assigned to this task")
        if not _is_clocked_in_today(db, user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Clock in for today before updating task progress",
            )
        if not fields.issubset(_ASSIGNEE_PROGRESS_FIELDS):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot edit task metadata")
        if "status" in fields and not _is_parent_assignee(task, user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only direct assignees can update task status",
            )
        if "sub_tasks" in fields:
            new_subs = [
                st.model_dump() if hasattr(st, "model_dump") else dict(st)
                for st in (payload.sub_tasks or [])
            ]
            _validate_sub_task_patch(task.sub_tasks or [], new_subs, user)
    if "billable_amount" in fields and not _can_set_price(role):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot set task price")
    update = payload.model_dump(exclude_unset=True, mode="json")
    if update.get("is_billable") is False:
        update["billable_amount"] = None
    # Coerce UUID fields the same way create does (mode=json yields strings).
    for key in ("assigned_to", "assigned_managers", "brand_id"):
        if key not in update:
            continue
        if update[key] is None:
            continue
        if key == "brand_id":
            update[key] = uuid.UUID(str(update[key]))
        else:
            update[key] = [uuid.UUID(str(v)) for v in update[key]]

    previous_assignees = {str(uid) for uid in (task.assigned_to or [])}
    # Track who assigned whenever assignment changes (owner/manager).
    if "assigned_to" in update and allowed_manager:
        update["assigned_by"] = user.id
    for key, value in update.items():
        setattr(task, key, value)
    # Auto-close Updates when marked Completed (owner/manager can reopen or purge later).
    if update.get("status") == "Completed" and not task.updates_closed and allowed_manager:
        task.updates_closed = True
        task.updates_closed_at = datetime.now(timezone.utc)
        task.updates_closed_by = user.id
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
    # Notify newly assigned people when managers re-assign on edit.
    if "assigned_to" in update:
        new_assignees = {str(uid) for uid in (task.assigned_to or [])} - previous_assignees
        for assignee_id in new_assignees:
            db.add(
                Notification(
                    user_id=uuid.UUID(assignee_id),
                    message=f'Task "{task.title}" assigned to you by {user.name}',
                    type="task",
                    link="/tasks",
                )
            )
        if new_assignees:
            db.commit()
    if task.status in {"Struggling", "Needs Attention"}:
        for manager_id in task.assigned_managers or []:
            db.add(
                Notification(
                    user_id=manager_id,
                    message=f'Task "{task.title}" flagged as {task.status}',
                    type="task",
                    link="/tasks",
                )
            )
        db.commit()
    DASHBOARD_CACHE.invalidate()
    brands = _brand_map(db, [task.brand_id] if task.brand_id else [])
    people = _people_map(db, [task.created_by, task.assigned_by])
    return _serialize(task, brands, role=role, creators=people, assigners=people)


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


@router.post("/{task_id}/updates/close")
def close_updates(
    task_id: uuid.UUID,
    purge: bool = Query(default=True, description="Delete chat messages to free storage"),
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> dict[str, Any]:
    """Owner/Manager closes the Updates channel for a finished task."""
    if Role(user.role) not in {Role.OWNER, Role.MANAGER}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Owner/Manager only")
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    purged = 0
    if purge:
        chats = db.scalars(select(TaskChat).where(TaskChat.task_id == task_id)).all()
        purged = len(chats)
        for chat in chats:
            db.delete(chat)
    task.updates_closed = True
    task.updates_closed_at = datetime.now(timezone.utc)
    task.updates_closed_by = user.id
    task.timeline = [
        *(task.timeline or []),
        {
            "by": str(user.id),
            "action": "Closed updates channel" + (f" (purged {purged} messages)" if purge else ""),
            "at": datetime.now(timezone.utc).isoformat(),
        },
    ]
    db.commit()
    db.refresh(task)
    DASHBOARD_CACHE.invalidate()
    brands = _brand_map(db, [task.brand_id] if task.brand_id else [])
    people = _people_map(db, [task.created_by, task.assigned_by])
    out = _serialize(task, brands, role=Role(user.role), creators=people, assigners=people)
    out["purged_messages"] = purged
    return out


@router.post("/{task_id}/updates/reopen")
def reopen_updates(
    task_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> dict[str, Any]:
    """Owner/Manager reopens a closed Updates channel."""
    if Role(user.role) not in {Role.OWNER, Role.MANAGER}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Owner/Manager only")
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    task.updates_closed = False
    task.updates_closed_at = None
    task.updates_closed_by = None
    task.timeline = [
        *(task.timeline or []),
        {
            "by": str(user.id),
            "action": "Reopened updates channel",
            "at": datetime.now(timezone.utc).isoformat(),
        },
    ]
    db.commit()
    db.refresh(task)
    DASHBOARD_CACHE.invalidate()
    brands = _brand_map(db, [task.brand_id] if task.brand_id else [])
    people = _people_map(db, [task.created_by, task.assigned_by])
    return _serialize(task, brands, role=Role(user.role), creators=people, assigners=people)


@router.get("/{task_id}/chats")
def list_chats(
    task_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> list[dict[str, Any]]:
    task = db.get(Task, task_id)
    if not task or not _can_view_db(db, task, user):
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
    if not task or not _can_view_db(db, task, user):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    if getattr(task, "updates_closed", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Updates channel is closed for this completed task",
        )
    chat = TaskChat(task_id=task_id, sender_id=user.id, **payload.model_dump())
    db.add(chat)
    db.commit()
    db.refresh(chat)

    def _as_uuid(value: Any) -> uuid.UUID | None:
        if value is None:
            return None
        try:
            return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))
        except (TypeError, ValueError):
            return None

    recipients: set[uuid.UUID] = set()
    for raw in (*(task.assigned_to or []), *(task.assigned_managers or [])):
        uid = _as_uuid(raw)
        if uid:
            recipients.add(uid)
    for raw in (task.created_by, task.assigned_by):
        uid = _as_uuid(raw)
        if uid:
            recipients.add(uid)
    # Sub-task assignees on this task
    for sub in task.sub_tasks or []:
        for raw in sub.get("assigned_to") or []:
            uid = _as_uuid(raw)
            if uid:
                recipients.add(uid)
    if task.brand_id:
        brand = db.get(Brand, task.brand_id)
        if brand:
            for raw in (*(brand.assigned_members or []), *(getattr(brand, "assigned_managers", None) or [])):
                uid = _as_uuid(raw)
                if uid:
                    recipients.add(uid)
    recipients.discard(user.id)

    preview = (chat.message or "").strip()
    if len(preview) > 80:
        preview = preview[:77] + "…"
    for recipient in recipients:
        db.add(
            Notification(
                user_id=recipient,
                message=f'{user.name} on "{task.title}": {preview}' if preview else f'{user.name} sent a message in "{task.title}"',
                type="chat",
                link=f"/updates?task={task.id}",
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
    brands_all = _brand_map(db, [task.brand_id for task in tasks if task.brand_id])
    visible: list[Task] = []
    for task in tasks:
        is_dev = task.type == "Development" or task.task_mode == "project"
        if not is_dev:
            continue
        brand = brands_all.get(task.brand_id) if task.brand_id else None
        if role in {Role.OWNER, Role.MANAGER} or _can_view(task, user, brand):
            visible.append(task)
    brands = {bid: brands_all[bid] for bid in {t.brand_id for t in visible if t.brand_id} if bid in brands_all}
    people = _people_map(
        db,
        [t.created_by for t in visible],
        [t.assigned_by for t in visible],
    )
    return [_serialize(task, brands, role=role, creators=people, assigners=people) for task in visible]
