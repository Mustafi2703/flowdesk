# Demo credentials — Scrumfolks TMS

Use these accounts to test roles in the app. **Do not commit real production passwords** — this file lists emails and where to find/set the shared demo password.

## Pull the repo (another machine)

```bash
git clone https://github.com/Mustafi2703/flowdesk.git
cd flowdesk
git checkout main
git pull origin main
```

## Production (Railway)

| | |
|---|---|
| **App (login)** | https://frontend-production-c885.up.railway.app/login |
| **Backend API** | https://backend-production-d5dd9.up.railway.app |

Sign in with **email + password** (no role buttons on the login page).

| Role | Email |
|------|-------|
| Owner | `owner@scrumfolks.com` |
| Manager | `manager@scrumfolks.com` |
| Team | `team@scrumfolks.com` |
| HR | `hr@scrumfolks.com` |
| Accounts | `accountant@scrumfolks.com` |

**Password:** the value of `SEED_PASSWORD` on the Railway **backend** service (Project → backend → Variables). All five accounts share that one password when `SEED_DEMO=true`.

Optional: while logged in as any user, if demo mode is on, the API exposes accounts + password at `GET /api/v1/auth/demo-info` (same origin via the Next proxy: `/api/auth/demo-info`).

## Local Docker (recommended for dev)

From the repo root:

```bash
# optional — override defaults
export SEED_PASSWORD='YourLocalTestPass123!'
export JWT_SECRET='scrumfolks-demo-jwt-secret-please-change-in-prod'

docker compose up --build
```

| | |
|---|---|
| **App** | http://127.0.0.1:3000/login |
| **Backend** | http://127.0.0.1:8000 |
| **Postgres** | `127.0.0.1:5544` — db `scrumfolks_tms`, user `tms` |

Default local demo password (if you do not set `SEED_PASSWORD`):

```
local-demo-only-change-me
```

Same five emails as production (`owner@scrumfolks.com`, etc.). Backend runs migrations + seed on first boot when `SEED_DEMO=true`.

## What each role can test

| Role | Good for testing |
|------|------------------|
| **Owner** | Google Drive/Calendar connect, team admin, prices, delete completed tasks, company calendar |
| **Manager** | Brand/task assignment, meetings scheduling, billable flags (no rupee amounts), review workflow |
| **Team** | Clock-in, task progress, file upload, Updates chat (must be clocked in) |
| **HR** | Leave, attendance views, employee calendar |
| **Accounts** | Invoicing / rupee pricing (with Owner) |

## Related setup docs

- `DEPLOYMENT_RAILWAY.md` — deploy from GitHub
- `DRIVE_SETUP.md` — Google Drive + Calendar/Meet OAuth
- `STORAGE_SETUP.md` — Cloudflare R2 (file uploads)
- `CURSOR_CONTEXT.md` — auth, tasks, RBAC rules for developers

## Security notes

- Never put Railway `SEED_PASSWORD`, SMTP passwords, or Google OAuth secrets in git.
- Production should use `SEED_DEMO=false` once real users are onboarded (bootstrap owner only).
- Local compose uses weak defaults on purpose — do not expose port 3000/8000 to the public internet without changing secrets.
