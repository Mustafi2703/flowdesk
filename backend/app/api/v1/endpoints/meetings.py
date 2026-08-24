"""Client meetings — schedule Google Meet syncs per brand."""

from __future__ import annotations

import secrets
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.api.v1.endpoints.brands import _can_view as brand_can_view
from app.core.config import settings
from app.core.roles import Role
from app.db.session import get_db
from app.models.brand import Brand
from app.models.client_meeting import ClientMeeting
from app.models.profile import Profile
from app.schemas.meeting import MeetingCreate
from app.services import google_calendar as gcal
from app.services.email import send_email

router = APIRouter(prefix="/meetings", tags=["meetings"])


def _can_schedule(user: Profile) -> bool:
    return Role(user.role) in {Role.OWNER, Role.MANAGER}


def _serialize(row: ClientMeeting, brand: Brand | None = None) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "brand_id": str(row.brand_id),
        "brand_name": brand.name if brand else None,
        "title": row.title,
        "description": row.description,
        "client_email": row.client_email,
        "attendee_emails": list(row.attendee_emails or []),
        "start_at": row.start_at.isoformat(),
        "duration_minutes": row.duration_minutes,
        "recurrence": row.recurrence,
        "recurrence_count": row.recurrence_count,
        "google_event_id": row.google_event_id,
        "google_meet_link": row.google_meet_link,
        "google_calendar_link": row.google_calendar_link,
        "created_by": str(row.created_by) if row.created_by else None,
        "created_at": row.created_at.isoformat(),
        "updated_at": row.updated_at.isoformat(),
    }


def _notify_client(
    *,
    to_email: str,
    brand_name: str,
    title: str,
    start_at: str,
    meet_link: str | None,
    calendar_link: str | None,
    recurrence: str,
) -> None:
    rec_label = recurrence if recurrence != "none" else "One-time"
    meet_block = (
        f'<p><a href="{meet_link}" style="color:#0B6A78;font-weight:600;">Join Google Meet</a></p>'
        if meet_link
        else "<p>Meet link will appear in your calendar invite.</p>"
    )
    cal_block = (
        f'<p><a href="{calendar_link}">Open in Google Calendar</a></p>' if calendar_link else ""
    )
    try:
        send_email(
            to=to_email,
            subject=f"Meeting scheduled · {brand_name} · {title}",
            html=f"""
            <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;">
              <h2 style="color:#0B6A78;">Client meeting · {brand_name}</h2>
              <p><strong>{title}</strong></p>
              <p>When: {start_at} (IST)<br/>Cadence: {rec_label}</p>
              {meet_block}
              {cal_block}
              <p style="color:#64748b;font-size:13px;">Sent from Scrumfolks TMS</p>
            </div>
            """,
            text=f"{title} with {brand_name} at {start_at}. Cadence: {rec_label}. Meet: {meet_link or 'see calendar invite'}",
        )
    except Exception:
        pass


@router.get("/status")
def meetings_status(
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> dict[str, Any]:
    row = gcal.get_integration(db)
    configured = gcal.calendar_configured()
    redirect = None
    if configured:
        try:
            redirect = gcal.redirect_uri()
        except RuntimeError:
            configured = False
    return {
        "configured": configured,
        "connected": bool(row),
        "account_email": row.account_email if row else None,
        "redirect_uri_hint": redirect,
        "can_connect": Role(user.role) is Role.OWNER,
        "can_schedule": _can_schedule(user),
    }


@router.get("/connect")
def meetings_connect(user: Profile = Depends(get_current_user)) -> dict[str, str]:
    if Role(user.role) is not Role.OWNER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Owner only")
    if not gcal.calendar_configured():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google OAuth is not configured")
    state = secrets.token_urlsafe(24)
    return {"url": gcal.auth_url(state=state)}


@router.get("/callback")
def meetings_callback(
    code: str | None = None,
    error: str | None = None,
    state: str | None = None,
    db: Session = Depends(get_db),
) -> RedirectResponse:
    frontend = (settings.app_base_url or "http://localhost:3000").rstrip("/")
    if error:
        return RedirectResponse(f"{frontend}/meetings?calendar=error&msg={error}", status_code=302)
    if not code:
        return RedirectResponse(f"{frontend}/meetings?calendar=error&msg=missing_code", status_code=302)
    try:
        payload = gcal.exchange_code(code)
        gcal.save_connection(db, token_payload=payload, connected_by=None)
    except Exception:
        return RedirectResponse(f"{frontend}/meetings?calendar=error&msg=token_exchange", status_code=302)
    return RedirectResponse(f"{frontend}/meetings?calendar=connected", status_code=302)


@router.get("")
def list_meetings(
    brand_id: uuid.UUID | None = Query(default=None),
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> list[dict[str, Any]]:
    stmt = select(ClientMeeting).order_by(ClientMeeting.start_at.desc())
    if brand_id:
        stmt = stmt.where(ClientMeeting.brand_id == brand_id)
    rows = db.scalars(stmt).all()
    brand_ids = {row.brand_id for row in rows}
    brands = {
        b.id: b
        for b in db.scalars(select(Brand).where(Brand.id.in_(brand_ids))).all()
    } if brand_ids else {}
    out: list[dict[str, Any]] = []
    for row in rows:
        brand = brands.get(row.brand_id)
        if not brand or not brand_can_view(brand, user):
            continue
        out.append(_serialize(row, brand))
    return out


@router.post("", status_code=status.HTTP_201_CREATED)
def create_meeting(
    payload: MeetingCreate,
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> dict[str, Any]:
    if not _can_schedule(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Owner/Manager only")
    brand = db.get(Brand, payload.brand_id)
    if not brand or not brand_can_view(brand, user):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Brand not found")
    client_email = (payload.client_email or brand.contact_email or "").strip()
    if not client_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Set a client email on the brand or in the meeting form",
        )
    if not brand.contact_email and payload.client_email:
        brand.contact_email = str(payload.client_email).strip()
    attendees = list({str(e).strip() for e in payload.attendee_emails if e})
    if client_email not in attendees:
        attendees.insert(0, client_email)
    if not gcal.get_integration(db):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Connect Google Calendar first (Meetings → Connect Google)",
        )
    try:
        event = gcal.create_calendar_event(
            db,
            title=f"{brand.name} · {payload.title}",
            description=payload.description,
            start_at=payload.start_at,
            duration_minutes=payload.duration_minutes,
            attendee_emails=attendees,
            recurrence=payload.recurrence,
            recurrence_count=payload.recurrence_count,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Could not create Google Calendar event: {exc}",
        ) from exc
    row = ClientMeeting(
        brand_id=brand.id,
        title=payload.title,
        description=payload.description,
        client_email=client_email,
        attendee_emails=attendees,
        start_at=payload.start_at,
        duration_minutes=payload.duration_minutes,
        recurrence=payload.recurrence,
        recurrence_count=payload.recurrence_count,
        google_event_id=event.get("event_id"),
        google_meet_link=event.get("meet_link"),
        google_calendar_link=event.get("calendar_link"),
        created_by=user.id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    _notify_client(
        to_email=client_email,
        brand_name=brand.name,
        title=payload.title,
        start_at=row.start_at.isoformat(),
        meet_link=row.google_meet_link,
        calendar_link=row.google_calendar_link,
        recurrence=row.recurrence,
    )
    return _serialize(row, brand)


@router.delete("/{meeting_id}")
def cancel_meeting(
    meeting_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: Profile = Depends(get_current_user),
) -> dict[str, bool]:
    if not _can_schedule(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Owner/Manager only")
    row = db.get(ClientMeeting, meeting_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    brand = db.get(Brand, row.brand_id)
    if not brand or not brand_can_view(brand, user):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    if row.google_event_id:
        try:
            gcal.delete_calendar_event(db, row.google_event_id)
        except Exception:
            pass
    db.delete(row)
    db.commit()
    return {"ok": True}
