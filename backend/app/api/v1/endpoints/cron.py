"""Protected cron endpoints for scheduled jobs."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.v1.deps import require_cron_secret
from app.db.session import get_db
from app.services.digests import send_daily_digests

router = APIRouter(prefix="/cron", tags=["cron"], dependencies=[Depends(require_cron_secret)])


@router.post("/daily-digests")
def daily_digests(db: Session = Depends(get_db)) -> dict[str, int]:
    return {"sent": send_daily_digests(db)}
