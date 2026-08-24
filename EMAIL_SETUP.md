# Email setup — Scrumfolks TMS

Task assignment emails **will not arrive** until SMTP (or Resend) can authenticate. The app already builds the HTML brief; delivery is blocked by missing mail credentials.

## What you need

A mailbox the server can send from. Either:

1. **Your Gmail (current Railway setup)** — `baibhabmustafi@gmail.com`  
2. **A dedicated TMS mailbox (recommended for the client)** — e.g. `tms@scrumfolks.com` on Google Workspace

You do **not** need a new product feature for this. You need one App Password (or Resend API key) on the **backend** Railway service.

## Option A — Gmail you already use (fastest for testing)

Railway backend already has:

- `EMAIL_PROVIDER=smtp`
- `SMTP_HOST=smtp.gmail.com`
- `SMTP_PORT=587`
- `SMTP_USER=baibhabmustafi@gmail.com`
- `EMAIL_FROM=Scrumfolks TMS <baibhabmustafi@gmail.com>`
- `EMAIL_TEST_RECIPIENT=baibhabmustafi@gmail.com` (every mail goes here while this is set)

**Multiple test inboxes (comma-separated):**

```
EMAIL_TEST_RECIPIENT=baibhabmustafi@gmail.com,hello@twinoxis.com
```

Each outbound email is delivered to **both** addresses while this variable is set. Subjects are prefixed with `[TEST → intended@user]` so you can tell which team member the brief was for.

**Missing:** `SMTP_PASSWORD`

1. Open Google Account → Security → 2-Step Verification (must be on).
2. [App passwords](https://myaccount.google.com/apppasswords) → Mail → generate.
3. Copy the 16-character password.
4. Railway → **backend** → Variables → set `SMTP_PASSWORD` to that value (no spaces).
5. Redeploy backend (or it will pick up the variable on the next restart).
6. Ask to send `POST /api/v1/cron/test-task-brief`. Check inbox **and spam**.

Normal Gmail password will always fail with `530 Authentication Required`.

## Option B — Dedicated TMS address (better for the client)

Create `tms@scrumfolks.com` (or `noreply@scrumfolks.com`) in Google Workspace, then on **backend**:

```
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USE_TLS=true
SMTP_USER=tms@scrumfolks.com
SMTP_PASSWORD=<Workspace App Password>
EMAIL_FROM=Scrumfolks TMS <tms@scrumfolks.com>
```

For real users (not a test inbox), **clear** `EMAIL_TEST_RECIPIENT` so each assignee gets their own copy.

## Option C — Resend

```
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_...
EMAIL_FROM=Scrumfolks TMS <tms@your-verified-domain>
```

## When mail is sent

- New task with assignees → formatted brief (Drive links, Open task, Open Updates)
- New person added on edit → brief to the new assignees
- Owner/Manager **Email brief** on the task page
- Optional evening digest (scheduler)

If SMTP is misconfigured, task create still succeeds. Mail failure is logged, not shown as a task error.

## After testing

Remove `EMAIL_TEST_RECIPIENT` so production mail goes to real assignee addresses.
