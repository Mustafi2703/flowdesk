# Scrumfolks TMS — Local Demo Guide

Full-stack Docker demo: **Next.js frontend** + **FastAPI backend** + **PostgreSQL**.

There is no Prisma runtime and no local Python virtualenv required. Everything runs inside Docker containers.

## Quick start (one command)

```bash
bash demo.sh
```

Then open **http://127.0.0.1:3000/login**

Stop everything:

```bash
bash demo-stop.sh
```

---

## Demo accounts

Password for every account: **`scrumfolks2026`**

| Role | Email | What you'll see |
|------|-------|-----------------|
| **Owner** | `owner@scrumfolks.com` | Full dashboard — all tasks, overdue, flagged, leave queue, billing |
| **Manager** | `manager@scrumfolks.com` | Team overview, create tasks, approve workflows |
| **Team** | `team@scrumfolks.com` | **Personalized** — only assigned tasks + clock in/out |
| **HR** | `hr@scrumfolks.com` | Leave approvals, staff count, performance |
| **Accountant** | `accountant@scrumfolks.com` | Billable tasks, set prices, mark billed |
| **Developer** | `dev@scrumfolks.com` | Dev Board, project sub-tasks |

Use the **Quick demo access** buttons on the login page to switch personas instantly.

---

## What's seeded

- **5 brands**: Dinamoo Lighting, Ayodhya Group, SmartiQo, Minotti India, GESIA ICT
- **10 tasks** across statuses (In Progress, Struggling, Overdue, Completed, etc.)
- **3 announcements** (Normal / Important / Urgent)
- **2 pending leave requests** (for HR demo)
- **1 project task** (SmartiQo Website Revamp) with sub-tasks for Dev Board

---

## Architecture

```
Browser → Next.js :3000
              ↓  /api/* proxies (sf_sess cookie forwarded)
          FastAPI :8000
              ↓
          PostgreSQL :5544
```

- **Frontend** keeps the original dark Scrumfolks UI and role-based navigation.
- **Backend** enforces permissions, stores data, and powers fast personalized dashboards.
- Both share **`JWT_SECRET`** and cookie **`sf_sess`** so Next.js middleware and FastAPI auth stay in sync.

---

## Advanced data structures (backend)

The personalized dashboard (`GET /api/v1/dashboard`) uses:

| Structure | Purpose |
|-----------|---------|
| **heapq PriorityHeap** | Ranks each user's open tasks by urgency (flagged → priority → days remaining) |
| **deque RingBuffer** | FIFO cache of last 50 notifications per user |
| **TTLCache (4s)** | Memoizes computed dashboard payloads to avoid repeated DB hits during burst loads |

After any mutation (task update, clock in, leave decision), the cache is invalidated so the next read is fresh.

---

## Demo walkthrough (15 minutes)

### 1. Owner — Rushabh (`owner@scrumfolks.com`)
- Dashboard: note **Total Tasks**, **Overdue**, **Flagged**, **Leave Pending**
- **Tasks** → create a new task, assign to Arjun (`team@scrumfolks.com`)
- **Brands** → open Dinamoo Lighting → see KPIs and assigned team
- **Billing** → set price on unpriced billable task → Mark Billed

### 2. Team — Arjun (`team@scrumfolks.com`)
- Log out → log in as Team
- Dashboard shows **only his tasks** + **Clock In** card
- Clock in → status turns green
- **Tasks** → change status on assigned task to "In Progress"
- Confirm he **cannot** see billing amounts

### 3. HR — Neha (`hr@scrumfolks.com`)
- **Leave** → approve Ravi's Casual leave
- **Performance** → team overview table
- **Team** → workload badges (Available / Moderate / Fully Loaded)

### 4. Accountant — Kavita (`accountant@scrumfolks.com`)
- **Billing** → yellow warning if unpriced tasks exist
- Set ₹ price → Mark Billed

### 5. Developer — Dev (`dev@scrumfolks.com`)
- **Dev Board** → SmartiQo project with sub-task progress bar
- Update sub-task status inline

---

## Logs & troubleshooting

```bash
docker compose logs -f backend frontend
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/docs    # FastAPI interactive docs
```

| Problem | Fix |
|---------|-----|
| Port 3000/8000 in use | `bash demo-stop.sh` then retry |
| Postgres won't start | `docker compose down -v` then `bash demo.sh` |
| Login fails | Ensure `JWT_SECRET` is the same for backend and frontend in `docker-compose.yml` |
| Empty tasks | `docker compose exec backend python -m app.scripts.seed` |

---

## Production deployment (after demo sign-off)

See **`DEPLOYMENT_FASTAPI.md`** for the hardened droplet setup:

- UFW firewall (SSH + 80 + 443 only)
- Nginx TLS reverse proxy
- Docker Compose stack
- Rotate all demo passwords and secrets before go-live

---

## Project layout

```
flowdesk/
├── frontend/          ← Next.js UI (from scrumfolks-tms-final.zip)
├── backend/           ← FastAPI API + data structures + seed
├── deploy/            ← Production Docker / Nginx / UFW scripts
├── docker-compose.yml ← Full local Docker stack
├── demo.sh            ← One-command local demo
├── demo-stop.sh
└── DEMO.md            ← This file
```
