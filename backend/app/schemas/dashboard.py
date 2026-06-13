"""Dashboard schemas."""

from __future__ import annotations

from pydantic import BaseModel


class DashboardOverview(BaseModel):
    stats: dict[str, int | float]
    recent_tasks: list[dict]
    announcements: list[dict]
    pending_leave_requests: list[dict] = []
    flagged_tasks: list[dict] = []
    clock_state: dict | None = None
