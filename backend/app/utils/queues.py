"""Fast in-memory data structures used to personalize dashboards.

We intentionally avoid touching the database on every dashboard refresh.
Instead, we hold three structures process-wide and rebuild them on a short
TTL whenever any user requests their personalized view:

* PriorityHeap   — heapq min-heap over (urgency_score, task)
                   urgency = (priority_weight, -days_remaining)
                   This gives O(log n) inserts and O(k log n) "top-k" reads,
                   which is ideal for "what should I do next?" lanes.
* RingBuffer     — collections.deque with a maxlen cap per user, used as a
                   FIFO cache of the user's last N notifications. O(1) push
                   and O(1) read of the tail.
* TTLCache       — small thread-safe key→(value, expires_at) map used to
                   memoize the computed dashboard payload per user for the
                   length of a single HTTP request burst (default 4 seconds).

All structures live in this module's process memory. They are deliberately
NOT distributed — for 40-50 users on a single gunicorn instance they are
plenty fast and avoid the operational cost of Redis.

If we ever scale horizontally we replace these with Redis-backed equivalents
without touching the API contracts.
"""

from __future__ import annotations

import heapq
import threading
import time
from collections import deque
from dataclasses import dataclass, field
from datetime import date
from typing import Any, Generic, Iterable, TypeVar

T = TypeVar("T")

_PRIORITY_WEIGHT = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}
_STATUS_OPEN = {
    "Not Started",
    "In Progress",
    "Under Review",
    "Revision Needed",
    "Struggling",
    "Needs Attention",
}


def urgency_score(task: dict[str, Any], *, today: date | None = None) -> tuple[int, int, int]:
    """Compute the heap key for a task.

    Lower scores pop first. We use a triple so heapq compares lexicographically:

    1. flagged status first (Struggling / Needs Attention)
    2. priority weight (Critical < High < Medium < Low)
    3. negative days-remaining so overdue items rank higher
    """
    today = today or date.today()
    flagged = 0 if task.get("status") in {"Struggling", "Needs Attention"} else 1
    weight = _PRIORITY_WEIGHT.get(task.get("priority") or "Medium", 2)
    due = task.get("due_date")
    if due is None:
        days_remaining = 999
    else:
        if isinstance(due, str):
            try:
                due_date = date.fromisoformat(due[:10])
            except ValueError:
                due_date = today
        else:
            due_date = due
        days_remaining = (due_date - today).days
    return (flagged, weight, days_remaining)


@dataclass(order=True)
class _HeapItem(Generic[T]):
    score: tuple[int, int, int]
    seq: int
    payload: T = field(compare=False)


class PriorityHeap(Generic[T]):
    """Min-heap exposing a clean `push` / `top_k` / `iter_sorted` API."""

    def __init__(self) -> None:
        self._heap: list[_HeapItem[T]] = []
        self._counter = 0
        self._lock = threading.Lock()

    def __len__(self) -> int:
        return len(self._heap)

    def push(self, score: tuple[int, int, int], payload: T) -> None:
        with self._lock:
            self._counter += 1
            heapq.heappush(self._heap, _HeapItem(score=score, seq=self._counter, payload=payload))

    def push_many(self, items: Iterable[tuple[tuple[int, int, int], T]]) -> None:
        for score, payload in items:
            self.push(score, payload)

    def top_k(self, k: int) -> list[T]:
        return [item.payload for item in heapq.nsmallest(k, self._heap)]

    def iter_sorted(self) -> Iterable[T]:
        for item in sorted(self._heap):
            yield item.payload


class RingBuffer(Generic[T]):
    """Bounded FIFO buffer using collections.deque."""

    def __init__(self, capacity: int = 50) -> None:
        self._buf: deque[T] = deque(maxlen=capacity)
        self._lock = threading.Lock()

    def push(self, item: T) -> None:
        with self._lock:
            self._buf.append(item)

    def latest(self, n: int | None = None) -> list[T]:
        with self._lock:
            data = list(self._buf)
        return data[-n:] if n else data


class TTLCache(Generic[T]):
    """Small thread-safe TTL cache for memoizing computed payloads.

    Designed for short windows (single-digit seconds) where many parallel
    requests for the same user can be served from one computed snapshot.
    """

    def __init__(self, ttl_seconds: float = 4.0) -> None:
        self._ttl = ttl_seconds
        self._store: dict[str, tuple[float, T]] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> T | None:
        now = time.monotonic()
        with self._lock:
            entry = self._store.get(key)
            if not entry:
                return None
            expires_at, value = entry
            if expires_at < now:
                self._store.pop(key, None)
                return None
            return value

    def set(self, key: str, value: T) -> None:
        with self._lock:
            self._store[key] = (time.monotonic() + self._ttl, value)

    def invalidate(self, key: str | None = None) -> None:
        with self._lock:
            if key is None:
                self._store.clear()
            else:
                self._store.pop(key, None)


# Process-wide instances. Keep them tiny — they all hold seconds of data.
DASHBOARD_CACHE: TTLCache[dict[str, Any]] = TTLCache(ttl_seconds=4.0)
NOTIFICATION_RINGS: dict[str, RingBuffer[dict[str, Any]]] = {}


def notification_ring(user_id: str) -> RingBuffer[dict[str, Any]]:
    """Get or lazily create a 50-item ring for a user's recent notifications."""
    buffer = NOTIFICATION_RINGS.get(user_id)
    if buffer is None:
        buffer = NOTIFICATION_RINGS[user_id] = RingBuffer(capacity=50)
    return buffer


def filter_open_tasks(tasks: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    return [task for task in tasks if task.get("status") in _STATUS_OPEN]
