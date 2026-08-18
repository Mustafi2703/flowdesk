# Scrumfolks TMS — agent context

This repo is a **monorepo**: Next.js UI in `frontend/`, FastAPI in `backend/`.
Production deploys from GitHub **`main`** to Railway (frontend + backend + Postgres).

Read `CURSOR_CONTEXT.md` before changing auth, tasks, brands, Updates, or email.

## Hard rules

- Do not commit secrets (`.env`, App Passwords, `SEED_PASSWORD`).
- Do not add demo-role buttons back to `/login`. Sign-in is email + password only.
- Do not wipe production data (`RESET_WORKSPACE` must stay false unless the user asks).
- Do not expose rupee prices to Manager or Team. Owner and Accountant only.
- Team must be clocked in before status/progress/review work.
- Frontend never talks to Postgres. Browser → `/api/*` (Next proxy) → FastAPI `/api/v1/*`.
- Session cookie is HttpOnly `sf_sess`. Same `JWT_SECRET` on frontend and backend.

## Where to edit

| Change | Start here |
|--------|------------|
| API / RBAC / email | `backend/app/` |
| UI pages | `frontend/src/components/pages/` |
| Routes / proxy | `frontend/src/app/` |
| Session helpers | `frontend/src/lib/auth.ts`, `backend/app/api/v1/deps.py` |
| Migrations | `backend/alembic/versions/` |
