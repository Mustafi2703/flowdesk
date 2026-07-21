"""Ensure demo brand/task documents exist (idempotent).

    python -m app.scripts.seed_docs
"""

from __future__ import annotations

from app.scripts.seed import ensure_demo_documents

if __name__ == "__main__":
    ensure_demo_documents()
