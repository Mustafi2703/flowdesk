"""Review versioning helpers (1 → 1.1 → 1.2 …)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID


def next_review_version(current: str | None) -> str:
    raw = (current or "1").strip() or "1"
    if "." not in raw:
        return f"{raw}.1"
    major, minor = raw.split(".", 1)
    try:
        return f"{major}.{int(minor) + 1}"
    except ValueError:
        return f"{raw}.1"


def review_history_entry(
    *,
    version: str,
    status: str,
    notes: str | None,
    by: UUID | str,
    by_name: str | None = None,
) -> dict[str, Any]:
    return {
        "version": version,
        "status": status,
        "notes": notes or "",
        "by": str(by),
        "by_name": by_name,
        "at": datetime.now(timezone.utc).isoformat(),
    }
