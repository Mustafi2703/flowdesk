"""Shared rate-limiter instance.

Lives in its own module so endpoint files can decorate handlers without
creating a circular import against `app.main`.

Backed by slowapi (a Starlette/FastAPI wrapper around limits). We use the
in-process memory backend, which is fine for a single droplet running ≤4
uvicorn workers and 50 concurrent users. For multi-host scaling, set
`storage_uri=redis://...` and slowapi will share counters across workers.
"""

from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address, default_limits=[])
