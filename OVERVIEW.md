# Scrumfolks TMS — Product Overview

This repository is now a Docker-first, end-to-end Scrumfolks Task Management System.

It contains:

- `frontend/` — the Next.js Scrumfolks UI from the shared demo zip.
- `backend/` — FastAPI + SQLAlchemy + Alembic + PostgreSQL.
- `docker-compose.yml` — one-command local stack for frontend, backend, and database.
- `demo.sh` / `demo-stop.sh` — demo lifecycle commands.

No Prisma app remains in the repo. The old root Next.js/Prisma prototype files were removed so the project has one clear runtime path: Docker Compose.

Run the demo:

```bash
bash demo.sh
```

Open `http://127.0.0.1:3000/login`.

See:

- `DEMO.md` for demo accounts and walkthrough.
- `backend/README.md` for API architecture.
- `DEPLOYMENT_FASTAPI.md` for production droplet deployment and firewall hardening.

## Current Product Scope

The app implements the Scrumfolks TMS modules from the requirement document:

- Dashboard with role-specific stats and personalized priority lane.
- Tasks with assignment, status updates, billable flags, project mode, and sub-tasks.
- Developer Board for development and project-mode tasks.
- Brands, Team, Performance, Attendance, Leave, Announcements, Billing.
- JWT authentication with HttpOnly `sf_sess` cookie.
- API-level RBAC for owner, manager, team, HR, accountant, and developer.
- Seeded demo users, brands, tasks, announcements, and leave requests.

## Runtime Architecture

```text
Browser
  -> Next.js frontend (:3000)
      -> /api/* proxy routes
          -> FastAPI backend (:8000)
              -> PostgreSQL (:5544 host / :5432 container)
```

The frontend never talks to the database directly. It calls local `/api/*` routes, and those routes forward requests to FastAPI. Backend authorization remains the source of truth.

## Performance Structure

The backend includes lightweight in-memory structures for fast demo dashboards:

- `heapq` priority queue for urgency-ranked task lanes.
- `deque` ring buffer for recent notifications.
- short TTL cache for repeated personalized dashboard reads.

These are intentionally process-local for the 40-50 user target. If the app later scales horizontally, these can move to Redis without changing the API.

## Authentication

The demo users are real seeded `profiles` rows with bcrypt password hashes. The default demo password is:

```text
scrumfolks2026
```

Change all passwords and secrets before production deployment.

## Docker Commands

```bash
bash demo.sh
docker compose logs -f backend frontend
bash demo-stop.sh
```

Reset local data:

```bash
docker compose down -v
```
