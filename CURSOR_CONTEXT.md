# Cursor / coding context — Scrumfolks TMS

Use this file at the start of a new Cursor chat so backend, frontend, and session work stay consistent.

## Product

Agency TMS: brands (clients), tasks, Updates chat, file review, attendance, leave, performance, billing.

Roles: **owner**, **manager**, **team**, **hr**, **accountant**.

Live:

- Frontend: https://frontend-production-c885.up.railway.app
- Backend: https://backend-production-d5dd9.up.railway.app
- Deploy: push **`main`** (Railway auto) or `railway redeploy --service backend|frontend --yes --from-source`

Client-facing feature list: `CLIENT_PRODUCT_GUIDE.md`.

## Layout

```
flowdesk/
  frontend/     Next.js App Router, proxy routes under src/app/api
  backend/      FastAPI, SQLAlchemy, Alembic, Postgres
  Dockerfile.frontend / Dockerfile.backend   Railway build from repo root
```

Browser never uses the database. Pages call `/api/...`. Those routes `proxy()` to FastAPI `/api/v1/...` and forward the `sf_sess` cookie.

## Session (do not reinvent)

1. Login `POST /api/auth/login` → FastAPI `POST /api/v1/auth/login`.
2. Backend sets HttpOnly cookie **`sf_sess`** (JWT). Payload: `id`, `name`, `email`, `role`, `avatar`.
3. Next middleware (`frontend/src/middleware.ts`) only checks that the cookie exists. It does **not** verify JWT on the Edge.
4. Server pages use `getSession()` / `requireRole()` in `frontend/src/lib/auth.ts` (jsonwebtoken + `JWT_SECRET`).
5. FastAPI uses `get_current_user` in `backend/app/api/v1/deps.py` (cookie, Bearer, or `x-access-token`).
6. Logout deletes the cookie. Change-password is in-app; no self-service forgot-password.

**Must match on both services:** `JWT_SECRET`, cookie name `sf_sess`, `COOKIE_SECURE` / `COOKIE_SAMESITE` / `COOKIE_DOMAIN`.

Do not sign a second cookie from Next for the same login. FastAPI is the source of the session.

Login UI is **email + password only**. Demo role buttons stay off the page. Seeded QA accounts (when `SEED_DEMO=true`) are:

| Role | Email |
|------|--------|
| Owner | owner@scrumfolks.com |
| Manager | manager@scrumfolks.com |
| Team | team@scrumfolks.com |
| HR | hr@scrumfolks.com |
| Accounts | accountant@scrumfolks.com |

Password is `SEED_PASSWORD` on Railway — share in chat, never commit it.

## Backend conventions

- Endpoints: `backend/app/api/v1/endpoints/`.
- RBAC in the endpoint, not only in the UI.
- Manager cannot set `billable_amount`. Owner/Accountant only.
- Task PATCH: team may only touch progress fields; clock-in required for status/checklist/sub-tasks/description.
- Drive links (`external_links`) may be added without clock-in.
- Creating/assigning a task sends `send_task_brief_emails` (`backend/app/services/task_brief_email.py`). Failures must not fail the API.
- If `EMAIL_TEST_RECIPIENT` is set, all mail is redirected there.
- Schema changes = new Alembic revision. Do not edit old migrations that already ran in production.
- Seed: `backend/app/scripts/seed.py`. Idempotent. Never enable `RESET_WORKSPACE` on production unless asked.

## Frontend conventions

- Client pages in `frontend/src/components/pages/*Client.tsx`.
- Dashboard pages are thin server wrappers that `getSession()` then render the client.
- New FastAPI routes need a matching `frontend/src/app/api/.../route.ts` proxy.
- Roles for nav: `NAV_ITEMS` in `frontend/src/types/index.ts`.
- Status colours: `StatusBadge` + `STATUS_BG` / `STATUS_TEXT`.
- Updates is **one chat per task**, not DMs. Keep the stacked header (title → status → review → Drive → messages → Send). Do not dump all actions into one wrapping row.
- Brand logo upload **replaces** the previous logo; hide the logo file from the documents list.

## Email (why test mail may not arrive)

Sending is **SMTP** on Railway today (`EMAIL_PROVIDER=smtp`, Gmail). Gmail returns `530 Authentication Required` until **`SMTP_PASSWORD`** is a [Google App Password](https://myaccount.google.com/apppasswords), not the normal Gmail password.

See `EMAIL_SETUP.md`. After the password is set, test:

`POST /api/v1/cron/test-task-brief` with header `x-cron-secret: <CRON_SECRET>`.

## What not to build unless asked

- Login role picker / demo-info on the public login page
- Private DMs
- Email OTP / forgot-password
- Force-push to `main`
- Production database wipes
