"""Google Drive OAuth + folder helpers for Scrumfolks TMS.

Owner connects one Google account. The app can then create a task folder
under "Scrumfolks TMS" in that Drive and attach the link to the task.
"""

from __future__ import annotations

import base64
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlencode

import httpx
from cryptography.fernet import Fernet
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.integration import Integration

PROVIDER = "google_drive"
SCOPES = "https://www.googleapis.com/auth/drive.file"
AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
DRIVE_FILES = "https://www.googleapis.com/drive/v3/files"
ROOT_FOLDER_NAME = "Scrumfolks TMS"


def drive_configured() -> bool:
    return bool(settings.google_oauth_client_id and settings.google_oauth_client_secret)


def redirect_uri() -> str:
    if settings.google_oauth_redirect_uri:
        return settings.google_oauth_redirect_uri.rstrip("/")
    # Prefer backend public URL if provided separately later; fallback is invalid for OAuth.
    raise RuntimeError("Set GOOGLE_OAUTH_REDIRECT_URI to the backend /api/v1/drive/callback URL")


def _fernet() -> Fernet:
    digest = hashlib.sha256(settings.jwt_secret.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_secret(value: str) -> str:
    return _fernet().encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_secret(value: str) -> str:
    return _fernet().decrypt(value.encode("utf-8")).decode("utf-8")


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


def refresh_access_token(refresh_token: str) -> dict[str, Any]:
    with httpx.Client(timeout=30) as client:
        res = client.post(
            TOKEN_URL,
            data={
                "client_id": settings.google_oauth_client_id,
                "client_secret": settings.google_oauth_client_secret,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            },
        )
        res.raise_for_status()
        return res.json()


def fetch_user_email(access_token: str) -> str | None:
    with httpx.Client(timeout=20) as client:
        res = client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if res.status_code >= 400:
            return None
        return (res.json() or {}).get("email")


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


def _drive_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _find_child_folder(token: str, name: str, parent_id: str | None = None) -> dict[str, Any] | None:
    q = f"name = '{name.replace(chr(39), chr(92) + chr(39))}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    if parent_id:
        q += f" and '{parent_id}' in parents"
    with httpx.Client(timeout=30) as client:
        res = client.get(
            DRIVE_FILES,
            headers=_drive_headers(token),
            params={"q": q, "fields": "files(id,name,webViewLink)", "pageSize": 1},
        )
        res.raise_for_status()
        files = (res.json() or {}).get("files") or []
        return files[0] if files else None


def _create_folder(token: str, name: str, parent_id: str | None = None) -> dict[str, Any]:
    body: dict[str, Any] = {
        "name": name,
        "mimeType": "application/vnd.google-apps.folder",
    }
    if parent_id:
        body["parents"] = [parent_id]
    with httpx.Client(timeout=30) as client:
        res = client.post(
            DRIVE_FILES,
            headers=_drive_headers(token),
            params={"fields": "id,name,webViewLink"},
            json=body,
        )
        res.raise_for_status()
        return res.json()


def ensure_root_folder(db: Session, row: Integration) -> tuple[str, str]:
    if row.root_folder_id and row.root_folder_url:
        return row.root_folder_id, row.root_folder_url
    token = _access_token(db, row)
    existing = _find_child_folder(token, ROOT_FOLDER_NAME)
    folder = existing or _create_folder(token, ROOT_FOLDER_NAME)
    row.root_folder_id = folder["id"]
    row.root_folder_url = folder.get("webViewLink") or f"https://drive.google.com/drive/folders/{folder['id']}"
    db.commit()
    return row.root_folder_id, row.root_folder_url


def create_task_folder(db: Session, *, task_title: str) -> dict[str, str]:
    row = get_integration(db)
    if not row:
        raise RuntimeError("Google Drive is not connected")
    root_id, _ = ensure_root_folder(db, row)
    token = _access_token(db, row)
    safe_name = (task_title or "Task").strip()[:120] or "Task"
    existing = _find_child_folder(token, safe_name, parent_id=root_id)
    folder = existing or _create_folder(token, safe_name, parent_id=root_id)
    url = folder.get("webViewLink") or f"https://drive.google.com/drive/folders/{folder['id']}"
    return {"id": folder["id"], "url": url, "label": f"Drive · {safe_name}"}


def save_connection(
    db: Session,
    *,
    token_payload: dict[str, Any],
    connected_by: Any,
) -> Integration:
    refresh = token_payload.get("refresh_token")
    access = token_payload.get("access_token")
    if not refresh:
        raise RuntimeError("Google did not return a refresh token. Disconnect the app in Google Account and try again.")
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
        row.root_folder_id = None
        row.root_folder_url = None
    db.commit()
    db.refresh(row)
    ensure_root_folder(db, row)
    db.refresh(row)
    return row
