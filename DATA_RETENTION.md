# Scrumfolks TMS — data retention policy

This document describes what the system keeps, for how long, and what happens when records are deleted.

## Tasks

| State | Who can delete | Policy |
|-------|----------------|--------|
| Active (not Completed) | Owner, Manager | Hard delete removes the task row, chat, and linked file attachments from storage. |
| **Completed** | **Owner only** | Managers cannot delete completed work. Owner delete is allowed for housekeeping but removes deliverables — prefer archiving in your own records first. |

Completed tasks auto-close the Updates channel but **do not** purge chat until an owner/manager runs **Close & purge** on Updates.

## Files & revisions

- Every upload is a separate `file_attachments` row with `created_at`, `review_version`, and `review_history` (status, notes, reviewer, **timestamp**).
- Rejected revisions stay in history; team uploads a new file for the next version (1 → 1.1 → 1.2 …).
- Manual file delete: owner/manager or original uploader.
- **Auto-delete** columns exist on attachments (`auto_delete_days`, `delete_at`).
- **Daily cron** `POST /api/v1/cron/cleanup-data` (header `X-Cron-Secret`) purges read notifications older than 90 days and chat on tasks whose Updates channel was closed 180+ days ago. Schedule on Railway alongside morning/evening digests.

## Leave

- All requests (Pending, Approved, Rejected) are kept for audit.
- Rejected leave does **not** count toward allowance; the employee must **submit a new request**.
- Decisions trigger in-app notification + email (when SMTP is configured).

## Attendance & performance

- Attendance logs are retained indefinitely unless you run a workspace reset (`RESET_WORKSPACE` — production only when explicitly requested).
- Performance snapshots follow the same DB retention as other operational data.

## Google Drive

- **Backend integration exists**: owner connects one Google account; owner/manager can create a Drive folder per task (`external_links` on the task).
- Requires `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI` on the backend. See `DRIVE_SETUP.md`.
- Drive is **optional** — files can also live in R2/Postgres via the attachments API.
- Disconnecting Drive does not delete folders already created in Google.

## Email

- Transactional mail (task briefs, leave decisions, review outcomes, digests) uses SMTP/Resend. Set `EMAIL_TEST_RECIPIENT` to redirect all mail in staging.
- Failed sends do not roll back the underlying API action.

## Recommended operational practice

1. Do not delete **Completed** tasks unless you have exported deliverables elsewhere.
2. Use **Updates → Close & purge** when chat history is no longer needed.
3. Connect Google Drive if the client expects folders in *their* Google Workspace; otherwise use in-app uploads (R2).
4. Review `STORAGE_SETUP.md` for R2 vs database-only storage on Railway.
