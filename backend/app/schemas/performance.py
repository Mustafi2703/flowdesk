"""Performance dashboard schemas."""

from __future__ import annotations

import uuid

from pydantic import BaseModel


class PerformanceCard(BaseModel):
    user_id: uuid.UUID
    name: str
    assigned: int
    completed: int
    in_progress: int
    overdue: int
    struggling: int
    completion_rate: float
    on_time_rate: float
    attendance_rate: float
    performance_tier: str


class TeamPerformanceOverview(BaseModel):
    team_size: int
    total_tasks: int
    average_completion_rate: float
    total_overdue: int
    members: list[PerformanceCard]
