"""Top-level API v1 router."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.endpoints import (
    ai,
    announcements,
    attendance,
    auth,
    billing,
    brands,
    cron,
    dashboard,
    leaves,
    notifications,
    performance,
    tasks,
    team,
    users,
)

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(dashboard.router)
api_router.include_router(tasks.router)
api_router.include_router(tasks.dev_router)
api_router.include_router(brands.router)
api_router.include_router(team.router)
api_router.include_router(users.router)
api_router.include_router(attendance.router)
api_router.include_router(leaves.router)
api_router.include_router(announcements.router)
api_router.include_router(billing.router)
api_router.include_router(notifications.router)
api_router.include_router(performance.router)
api_router.include_router(ai.router)
api_router.include_router(cron.router)
