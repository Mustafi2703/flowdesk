"""Structured task-brief emails for assignees."""

from __future__ import annotations

import html
import uuid
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.brand import Brand
from app.models.profile import Profile
from app.models.task import Task
from app.services.email import send_email


def _recipient_email(assignee: Profile) -> str | None:
    override = (settings.email_test_recipient or "").strip()
    if override:
        return override
    email = (assignee.email or "").strip()
    return email or None


def _fmt_date(value) -> str:
    if not value:
        return "—"
    try:
        return value.strftime("%d %b %Y")
    except AttributeError:
        return str(value)


def _priority_color(priority: str) -> str:
    return {
        "Critical": "#DC2626",
        "High": "#E8630A",
        "Medium": "#CA8A04",
        "Low": "#16A34A",
    }.get(priority or "", "#6B7280")


def _status_color(status: str) -> str:
    return {
        "Not Started": "#6B7280",
        "In Progress": "#2563EB",
        "Under Review": "#7C3AED",
        "Revision Needed": "#DC2626",
        "Completed": "#16A34A",
        "Struggling": "#EA580C",
        "Needs Attention": "#D97706",
        "On Hold": "#64748B",
    }.get(status or "", "#6B7280")


def _safe_url(raw: str) -> str | None:
    url = (raw or "").strip()
    if url.startswith("https://") or url.startswith("http://"):
        return url
    return None


def _row(label: str, value_html: str) -> str:
    return (
        "<tr>"
        f'<td style="padding:9px 0;border-bottom:1px solid #F3F4F6;width:130px;color:#6B7280;font-size:13px;">{html.escape(label)}</td>'
        f'<td style="padding:9px 0;border-bottom:1px solid #F3F4F6;font-size:13px;color:#1A1A2E;">{value_html}</td>'
        "</tr>"
    )


def build_task_brief_email(
    *,
    task: Task,
    assignee: Profile,
    assigner: Profile | None,
    brand: Brand | None,
    co_assignees: list[str] | None = None,
) -> tuple[str, str, str]:
    """Return (subject, html, text) for one assignee."""
    title = task.title or "Untitled task"
    brand_name = brand.name if brand else "No brand"
    assigner_name = assigner.name if assigner else "Scrumfolks TMS"
    base = settings.app_base_url.rstrip("/")
    task_url = f"{base}/tasks/{task.id}"
    updates_url = f"{base}/updates?task={task.id}"

    description = (task.description or "").strip() or "No description provided."
    sub_tasks = task.sub_tasks or []
    checklist = task.checklist or []
    links = [link for link in (getattr(task, "external_links", None) or []) if isinstance(link, dict)]
    people = [name for name in (co_assignees or []) if name]
    if assignee.name and assignee.name not in people:
        people = [assignee.name, *people]

    sub_html = "".join(
        (
            f"<li style='margin:0 0 6px;'><strong>{html.escape(str(st.get('title', 'Sub-task')))}</strong>"
            f" — {html.escape(str(st.get('status', 'Not Started')))}"
            + (f" · due {html.escape(str(st.get('due_date')))}" if st.get("due_date") else "")
            + "</li>"
        )
        for st in sub_tasks
    )
    checklist_html = "".join(
        f"<li style='margin:0 0 6px;'>{'✓' if item.get('done') else '○'} {html.escape(str(item.get('text', '')))}</li>"
        for item in checklist
    )

    drive_buttons = []
    drive_text_lines = []
    for link in links:
        url = _safe_url(str(link.get("url") or ""))
        if not url:
            continue
        label = str(link.get("label") or "Open Drive folder")
        drive_buttons.append(
            f'<a href="{html.escape(url)}" style="display:inline-block;margin:0 8px 8px 0;background:#1A73E8;color:#FFFFFF;text-decoration:none;padding:10px 14px;border-radius:8px;font-weight:700;font-size:13px;">{html.escape(label)}</a>'
        )
        drive_text_lines.append(f"- {label}: {url}")

    if drive_buttons:
        drive_html = (
            '<div style="background:#EEF4FF;border:1px solid #D2E3FC;border-radius:10px;padding:16px;margin:20px 0 0;">'
            '<div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#1A73E8;margin-bottom:8px;">Google Drive &amp; files</div>'
            '<p style="margin:0 0 12px;color:#374151;font-size:13px;line-height:1.5;">Use these folders for working files. Deliverables can also be uploaded on the task page.</p>'
            f"{''.join(drive_buttons)}"
            "</div>"
        )
    else:
        drive_html = (
            '<div style="background:#F9FAFB;border:1px dashed #E5E7EB;border-radius:10px;padding:16px;margin:20px 0 0;">'
            '<div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6B7280;margin-bottom:6px;">Google Drive &amp; files</div>'
            '<p style="margin:0;color:#6B7280;font-size:13px;">No Drive folder attached yet. Open the task to add a Google Drive, Dropbox, or Figma link.</p>'
            "</div>"
        )

    people_html = html.escape(", ".join(people) if people else "You")
    subject = f"Task assigned · {title} · {brand_name}"

    html_body = f"""
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F4F4F5;font-family:Arial,Helvetica,sans-serif;color:#1A1A2E;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F4F5;padding:24px 12px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid #E5E7EB;">
        <tr>
          <td style="background:#1A1A2E;padding:22px 24px;">
            <div style="color:#E8630A;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Scrumfolks TMS</div>
            <div style="color:#FFFFFF;font-size:22px;font-weight:700;margin-top:6px;">You have a new task</div>
            <div style="color:#A1A1AA;font-size:13px;margin-top:6px;">Assigned by {html.escape(assigner_name)}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:24px;">
            <p style="margin:0 0 8px;font-size:15px;">Hi {html.escape(assignee.name)},</p>
            <p style="margin:0 0 18px;color:#4B5563;font-size:14px;line-height:1.55;">
              Please review the brief, Drive folder, and due date below. Chat lives in Updates for this task.
            </p>
            <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;">{html.escape(title)}</h1>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
              {_row("Brand", html.escape(brand_name))}
              {_row("Type", html.escape(task.type or "—"))}
              {_row("Priority", f'<span style="color:{_priority_color(task.priority)};font-weight:700;">{html.escape(task.priority or "—")}</span>')}
              {_row("Status", f'<span style="color:{_status_color(task.status)};font-weight:700;">{html.escape(task.status or "—")}</span>')}
              {_row("Start", _fmt_date(task.start_date))}
              {_row("Due", f'<strong>{_fmt_date(task.due_date)}</strong>')}
              {_row("Review", "Required" if task.requires_review else "Not required")}
              {_row("Assigned to", people_html)}
            </table>
            <h3 style="margin:20px 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:0.06em;color:#6B7280;">Brief</h3>
            <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:14px;font-size:14px;line-height:1.6;white-space:pre-wrap;">{html.escape(description)}</div>
            {f'<h3 style="margin:20px 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:0.06em;color:#6B7280;">Sub-tasks</h3><ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.7;">{sub_html}</ul>' if sub_html else ""}
            {f'<h3 style="margin:20px 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:0.06em;color:#6B7280;">Checklist</h3><ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.7;">{checklist_html}</ul>' if checklist_html else ""}
            {drive_html}
            <p style="margin:28px 0 0;">
              <a href="{html.escape(task_url)}" style="display:inline-block;background:#E8630A;color:#FFFFFF;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700;font-size:14px;margin-right:8px;">Open task</a>
              <a href="{html.escape(updates_url)}" style="display:inline-block;background:#FFFFFF;color:#1A1A2E;text-decoration:none;padding:11px 16px;border-radius:8px;font-weight:700;font-size:14px;border:1px solid #E5E7EB;">Open Updates chat</a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 24px;background:#F9FAFB;color:#6B7280;font-size:12px;line-height:1.5;">
            Scrumfolks Task Management System · assigned by {html.escape(assigner_name)}
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
""".strip()

    sub_text = "\n".join(
        f"- {st.get('title', 'Sub-task')} ({st.get('status', 'Not Started')})" for st in sub_tasks
    )
    checklist_text = "\n".join(
        f"- [{'x' if item.get('done') else ' '}] {item.get('text', '')}" for item in checklist
    )
    links_text = "\n".join(drive_text_lines)

    text_body = f"""Scrumfolks TMS — Task assigned

Hi {assignee.name},

{assigner_name} assigned you a task.

Title: {title}
Brand: {brand_name}
Type: {task.type or '—'}
Priority: {task.priority or '—'}
Status: {task.status or '—'}
Start: {_fmt_date(task.start_date)}
Due: {_fmt_date(task.due_date)}
Review: {'Required' if task.requires_review else 'Not required'}
Assigned to: {', '.join(people) if people else 'You'}

Brief:
{description}
"""
    if sub_text:
        text_body += f"\nSub-tasks:\n{sub_text}\n"
    if checklist_text:
        text_body += f"\nChecklist:\n{checklist_text}\n"
    if links_text:
        text_body += f"\nGoogle Drive & files:\n{links_text}\n"
    else:
        text_body += "\nGoogle Drive & files:\nNo Drive folder attached yet.\n"
    text_body += f"\nOpen task: {task_url}\nOpen Updates chat: {updates_url}\n"

    return subject, html_body, text_body


def send_task_brief_emails(
    db: Session,
    task: Task,
    *,
    assigner: Profile | None,
    assignee_ids: Iterable[uuid.UUID] | None = None,
) -> int:
    """Email structured task briefs to assignees. Returns number of emails sent."""
    if not settings.task_brief_emails_enabled:
        return 0

    ids = list(assignee_ids if assignee_ids is not None else (task.assigned_to or []))
    if not ids:
        return 0

    assignees = {
        profile.id: profile
        for profile in db.scalars(select(Profile).where(Profile.id.in_(ids), Profile.is_active.is_(True))).all()
    }
    brand = db.get(Brand, task.brand_id) if task.brand_id else None
    co_assignees = [profile.name for profile in assignees.values() if profile.name]
    override = (settings.email_test_recipient or "").strip().lower()

    sent = 0
    seen: set[str] = set()
    for assignee_id in ids:
        assignee = assignees.get(assignee_id)
        if not assignee:
            continue
        to = _recipient_email(assignee)
        if not to:
            continue
        key = to.lower()
        if key in seen:
            continue
        seen.add(key)
        subject, html_body, text_body = build_task_brief_email(
            task=task,
            assignee=assignee,
            assigner=assigner,
            brand=brand,
            co_assignees=co_assignees,
        )
        try:
            send_email(to=to, subject=subject, html=html_body, text=text_body)
            sent += 1
        except Exception as exc:  # noqa: BLE001 — don't fail task API if email fails
            print(f"[task-brief-email] failed for {to}: {exc}")  # noqa: T201
        if override:
            break
    return sent
