# Scrumfolks TMS FastAPI Backend

Production backend for `tasks.scrumfolks.com`, built for the SCRUMFOLKS Task Management System requirements.

## What Is Included

- FastAPI app with versioned API at `/api/v1`
- PostgreSQL data model for all Phase 1 tables:
  - `profiles`
  - `brands`
  - `tasks`
  - `task_chats`
  - `file_attachments`
  - `attendance_logs`
  - `leave_requests`
  - `announcements`
  - `notifications`
  - `daily_summaries`
  - `sop_documents`
- JWT auth with HttpOnly cookie support
- Role-based API authorization for owner, manager, team, HR, accountant, developer
- Tasks, project sub-tasks, developer board, billing, attendance, leave, performance, announcements, notifications
- Claude AI task-description endpoint
- Resend/SMTP/console email delivery
- Protected cron endpoint for weekday daily digests
- Alembic migrations and launch seed data
- Docker/Uvicorn deployment for local demo and DigitalOcean-style droplet

## Local Setup

Use Docker from the repository root:

```bash
bash demo.sh
```

The backend container waits for PostgreSQL, runs Alembic migrations, seeds demo data, and starts Uvicorn automatically.

Health check:

```bash
curl http://127.0.0.1:8000/health
```

Default seed password is `scrumfolks2026`. Change every seed-user password immediately after launch.

## Production Sizing

For 40-50 users, this deployment runs:

- Uvicorn workers in the backend container
- PostgreSQL pool size 20, max overflow 10
- Nginx TLS reverse proxy
- UFW allowing only SSH, HTTP, HTTPS
- API/Postgres bound to `127.0.0.1` on the host

This is enough for a lightweight internal operational app on a 2 vCPU / 4 GB RAM droplet. Use managed Postgres if uptime/backups become critical.
