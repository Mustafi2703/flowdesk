"""Google Calendar OAuth + Meet link creation for client meetings."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlencode

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.integration import Integration
from app.services.google_drive import (
    AUTH_URL,
    TOKEN_URL,
    decrypt_secret,
    encrypt_secret,
    fetch_user_email,
    refresh_access_token,
)

PROVIDER = "google_calendar"
SCOPES = "https://www.googleapis.com/auth/calendar.events"
CALENDAR_EVENTS = "https://www.googleapis.com/calendar/v3/calendars/primary/events"
TZ = "Asia/Kolkata"

RECURRENCE_RRULE: dict[str, str | None] = {
    "none": None,
    "weekly": "RRULE:FREQ=WEEKLY",
    "monthly": "RRULE:FREQ=MONTHLY",
    "quarterly": "RRULE:FREQ=MONTHLY;INTERVAL=3",
    "yearly": "RRULE:FREQ=YEARLY",
}


def calendar_configured() -> bool:
    return bool(settings.google_oauth_client_id and settings.google_oauth_client_secret)


def redirect_uri() -> str:
    explicit = getattr(settings, "google_calendar_redirect_uri", None)
    if explicit:
        return str(explicit).rstrip("/")
    drive_uri = (settings.google_oauth_redirect_uri or "").rstrip("/")
    if drive_uri.endswith("/drive/callback"):
        return drive_uri.replace("/drive/callback", "/meetings/callback")
    raise RuntimeError(
        "Set GOOGLE_CALENDAR_REDIRECT_URI or GOOGLE_OAUTH_REDIRECT_URI "
        "to the backend /api/v1/meetings/callback URL"
    )


def auth_url(*, state: str) -> str:
    params = {
        "client_id": settings.google_oauth_client_id,
        "redirect_uri": redirect_uri(),
        "response_type": "code",
        "scope": SCOPES,
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }
    return f"{AUTH_URL}?{urlencode(params)}"


def exchange_code(code: str) -> dict[str, Any]:
    with httpx.Client(timeout=30) as client:
        res = client.post(
            TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.google_oauth_client_id,
                "client_secret": settings.google_oauth_client_secret,
                "redirect_uri": redirect_uri(),
                "grant_type": "authorization_code",
            },
        )
        res.raise_for_status()
        return res.json()


def get_integration(db: Session) -> Integration | None:
    return db.scalar(
        select(Integration).where(
            Integration.provider == PROVIDER,
            Integration.is_active.is_(True),
        )
    )


def _access_token(db: Session, row: Integration) -> str:
    now = datetime.now(timezone.utc)
    if row.access_token_enc and row.token_expires_at and row.token_expires_at > now + timedelta(seconds=60):
        return decrypt_secret(row.access_token_enc)
    refresh = decrypt_secret(row.refresh_token_enc)
    data = refresh_access_token(refresh)
    access = data["access_token"]
    expires_in = int(data.get("expires_in") or 3600)
    row.access_token_enc = encrypt_secret(access)
    row.token_expires_at = now + timedelta(seconds=expires_in)
    if data.get("refresh_token"):
        row.refresh_token_enc = encrypt_secret(data["refresh_token"])
    db.commit()
    return access


def save_connection(db: Session, *, token_payload: dict[str, Any], connected_by: Any) -> Integration:
    refresh = token_payload.get("refresh_token")
    access = token_payload.get("access_token")
    if not refresh:
        raise RuntimeError("Google did not return a refresh token. Revoke app access and reconnect.")
    email = fetch_user_email(access) if access else None
    row = db.scalar(select(Integration).where(Integration.provider == PROVIDER))
    now = datetime.now(timezone.utc)
    expires_in = int(token_payload.get("expires_in") or 3600)
    if row is None:
        row = Integration(
            provider=PROVIDER,
            account_email=email,
            refresh_token_enc=encrypt_secret(refresh),
            access_token_enc=encrypt_secret(access) if access else None,
            token_expires_at=now + timedelta(seconds=expires_in),
            connected_by=connected_by,
            is_active=True,
        )
        db.add(row)
    else:
        row.account_email = email or row.account_email
        row.refresh_token_enc = encrypt_secret(refresh)
        row.access_token_enc = encrypt_secret(access) if access else None
        row.token_expires_at = now + timedelta(seconds=expires_in)
        row.connected_by = connected_by
        row.is_active = True
    db.commit()
    db.refresh(row)
    return row


def _rrule(recurrence: str, count: int | None) -> list[str] | None:
    base = RECURRENCE_RRULE.get(recurrence)
    if not base:
        return None
    rule = base if not count else f"{base};COUNT={count}"
    return [rule]


def create_calendar_event(
    db: Session,
    *,
    title: str,
    description: str | None,
    start_at: datetime,
    duration_minutes: int,
    attendee_emails: list[str],
    recurrence: str = "none",
    recurrence_count: int | None = None,
) -> dict[str, str | None]:
    row = get_integration(db)
    if not row:
        raise RuntimeError("Google Calendar is not connected")
    token = _access_token(db, row)
    if start_at.tzinfo is None:
        start_at = start_at.replace(tzinfo=timezone.utc)
    end_at = start_at + timedelta(minutes=duration_minutes)
    request_id = str(uuid.uuid4())
    body: dict[str, Any] = {
        "summary": title,
        "description": description or "",
        "start": {"dateTime": start_at.isoformat(), "timeZone": TZ},
        "end": {"dateTime": end_at.isoformat(), "timeZone": TZ},
        "attendees": [{"email": e} for e in attendee_emails if e],
        "conferenceData": {
            "createRequest": {
                "requestId": request_id,
                "conferenceSolutionKey": {"type": "hangoutsMeet"},
            }
        },
        "reminders": {"useDefault": True},
    }
    rules = _rrule(recurrence, recurrence_count)
    if rules:
        body["recurrence"] = rules
    with httpx.Client(timeout=30) as client:
        res = client.post(
            CALENDAR_EVENTS,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            params={"conferenceDataVersion": 1, "sendUpdates": "all"},
            json=body,
        )
        res.raise_for_status()
        data = res.json()
    meet_link = None
    for entry in (data.get("conferenceData") or {}).get("entryPoints") or []:
        if entry.get("entryPointType") == "video":
            meet_link = entry.get("uri")
            break
    return {
        "event_id": data.get("id"),
        "meet_link": meet_link or data.get("hangoutLink"),
        "calendar_link": data.get("htmlLink"),
    }


def delete_calendar_event(db: Session, event_id: str) -> None:
    row = get_integration(db)
    if not row or not event_id:
        return
    token = _access_token(db, row)
    with httpx.Client(timeout=30) as client:
        res = client.delete(
            f"{CALENDAR_EVENTS}/{event_id}",
            headers={"Authorization": f"Bearer {token}"},
            params={"sendUpdates": "all"},
        )
        if res.status_code not in (204, 404):
            res.raise_for_status()
