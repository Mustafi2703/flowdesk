"""Email delivery abstraction.

Resend is the production path. The console provider is useful in local/dev
and prevents accidental sends during setup.
"""

from __future__ import annotations

import smtplib
from email.message import EmailMessage

import httpx

from app.core.config import settings


def send_email(*, to: str, subject: str, html: str, text: str | None = None) -> None:
    if settings.email_provider == "console":
        print(f"[email:console] to={to} subject={subject}\n{text or html}")  # noqa: T201
        return

    if settings.email_provider == "resend":
        if not settings.resend_api_key:
            raise RuntimeError("RESEND_API_KEY is required")
        response = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json={"from": settings.email_from, "to": [to], "subject": subject, "html": html, "text": text},
            timeout=20,
        )
        response.raise_for_status()
        return

    if not settings.smtp_host:
        raise RuntimeError("SMTP_HOST is required")
    message = EmailMessage()
    message["From"] = settings.email_from
    message["To"] = to
    message["Subject"] = subject
    message.set_content(text or "Open Scrumfolks TMS to view this email.")
    message.add_alternative(html, subtype="html")
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as smtp:
        if settings.smtp_use_tls:
            smtp.starttls()
        if settings.smtp_user and settings.smtp_password:
            smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.send_message(message)
