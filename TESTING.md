# Scrumfolks TMS — Requirements Test Guide

Use this checklist to verify **every module** matches the requirements document before client handoff. Test on the **live demo** or locally.

**Live demo:** https://frontend-production-c885.up.railway.app/login  
**Demo access:** use the role buttons on the login page, or sign in with credentials supplied by your admin (`SEED_PASSWORD` on the server).

**Automated backend suite (77 tests):** see `DEPLOYMENT_FASTAPI.md` §11 or run:

```bash
docker compose up -d postgres
docker run --rm --network flowdesk_default \
  -e PYTHONPATH=/app -e DATABASE_URL="postgresql+psycopg://tms:scrumfolks-demo-pw@postgres:5432/scrumfolks_tms_test" \
  -e TEST_DATABASE_URL="postgresql+psycopg://tms:scrumfolks-demo-pw@postgres:5432/scrumfolks_tms_test" \
  -e JWT_SECRET=test -e CRON_SECRET=test \
  -v "$PWD/backend/app:/app/app:ro" -v "$PWD/backend/tests:/app/tests:ro" \
  -w /app flowdesk-backend:latest \
  bash -lc "pip install -q pytest pytest-asyncio && pytest -q"
```

---

## UI — Night / Morning mode

1. Open the app → sidebar (or login page) shows **☀ Morning** and **🌙 Night** toggle.
2. Switch to **Morning** → light CRM-style background, white cards, readable tables.
3. Switch to **Night** → dark professional CRM theme.
4. Refresh the page → your choice persists.
5. Walk through Tasks, Billing, Team — all screens respect the theme.

---

## §3 Roles & access matrix

| Role | Email | Can access | Cannot access |
|------|-------|------------|---------------|
| Owner | `owner@scrumfolks.com` | Everything | — |
| Manager | `manager@scrumfolks.com` | Tasks, brands, team onboarding (team/dev only), performance, announcements | Delete tasks, billing amounts, privileged user creation |
| Team | `team@scrumfolks.com` | Assigned tasks/brands only, attendance, leave | Create tasks, billing, team module |
| HR | `hr@scrumfolks.com` | Team, leave approval, performance, attendance (others) | Billing edit, task delete |
| Accountant | `accountant@scrumfolks.com` | Billing (full), all brands | Team management, performance |
| Developer | `dev@scrumfolks.com` | Dev board, assigned dev tasks | Standard task board (non-dev) |

**Test:** Log in as each role → sidebar shows only allowed modules. Direct URL to forbidden module should fail or redirect.

---

## §4.1 Dashboard

**As Owner (`owner@scrumfolks.com`):**
- [ ] Stats: total tasks, completed, overdue, flagged, pending leave requests
- [ ] Priority lane lists urgent/flagged tasks first
- [ ] Recent tasks and announcements visible

**As Team (`team@scrumfolks.com`):**
- [ ] Personal stats: my tasks, completed, due today, in progress
- [ ] Clock In / Clock Out card works
- [ ] Only sees own workload, not company-wide secrets

**As HR:** leave pending + staff count  
**As Accountant:** billable tasks + pending billing counts

---

## §4.2–4.3 Tasks

**As Owner or Manager:**
- [ ] Create task → default status **Not Started** (Title Case)
- [ ] Assign to team member → assignee gets notification
- [ ] Set status to **Needs Attention** → manager notified (flag)

**As Team (assigned):**
- [ ] Sees only assigned tasks
- [ ] Can change **status** only (not title/metadata)
- [ ] Task chat works for participants; outsiders cannot see task

**As Owner only:**
- [ ] Can delete task

**As Team:**
- [ ] Cannot create tasks (403 / no create button)

---

## §4.3 Dev Board

**As Developer (`dev@scrumfolks.com`):**
- [ ] Dev Board shows Development / project-mode tasks
- [ ] Does not show unrelated design tasks

---

## §4.4 Brands

**As Owner/Manager:**
- [ ] Create brand with client type, priority, goals

**As Team:**
- [ ] Sees only brands where they are assigned members

**As Accountant/HR:**
- [ ] Sees all brands

---

## §4.5 Team & user management

**As Owner:**
- [ ] Add User → any role → receives **temporary password** once
- [ ] Reset password (owner/HR flow)
- [ ] Deactivate user → they cannot log in
- [ ] Reactivate user

**As Manager:**
- [ ] Can add **team** and **developer** only
- [ ] Cannot add owner, manager, HR, accountant (403)

**As HR:**
- [ ] Can reset password for team members
- [ ] Cannot reset owner/manager passwords

**As Team:**
- [ ] No access to Team module

**Workload:**
- [ ] Team page shows workload badges (Available / Moderate / Fully Loaded) based on active tasks

---

## §4.6 Performance

**As Owner/Manager/HR:**
- [ ] Performance page loads team overview
- [ ] Completion rate and tier (Excellent ≥80%, Good ≥60%, etc.)

**As Team/Developer:**
- [ ] Performance page blocked

---

## §4.7 Attendance

**As any staff:**
- [ ] Clock in → session starts
- [ ] Clock out → hours calculated
- [ ] Only one session per day

**As HR/Admin:**
- [ ] Can view another user's attendance log

**As Team:**
- [ ] Cannot view others' attendance

---

## §4.8 Leave

**As Team:**
- [ ] Submit leave → days calculated inclusively
- [ ] Balance starts at 21 days
- [ ] Sees only own requests

**As HR/Owner:**
- [ ] Approve → balance decrements
- [ ] Reject → balance unchanged
- [ ] Cannot re-approve/re-reject same request
- [ ] Notified when team submits leave

---

## §4.9 Announcements

**As Owner/Manager:**
- [ ] Post announcement → all users notified

**As Team:**
- [ ] Can read, cannot post
- [ ] Mark as read tracked per user

---

## §4.10 Billing

**As Accountant/Owner:**
- [ ] Set price on billable task
- [ ] Mark as billed (requires price first)
- [ ] Summary: total billable, billed, pending

**As Manager:**
- [ ] Sees billable **flag** but **not** rupee amounts

**As Team:**
- [ ] No billing module access
- [ ] Assigned tasks never show billable amount

---

## §5 Notifications

- [ ] Bell/list shows assignment, flag, leave, announcement events
- [ ] Mark as read works
- [ ] Cannot mark another user's notification

---

## §6 AI task description

**As Owner/Manager:**
- [ ] AI write returns description (fallback text if no API key)

**As Team:**
- [ ] Blocked (403)

---

## §9 Authentication & security

- [ ] Login sets session; logout clears it
- [ ] Wrong password rejected
- [ ] Inactive user cannot log in
- [ ] Change password works (admin reset flow for production)
- [ ] Password reset is **admin-driven** (owner/HR reset temp password — no self-service forgot-password)

---

## §10 Cron (production)

- [ ] `/api/cron/daily-digests` requires `X-Cron-Secret` header
- [ ] Without secret → 401

---

## Production bootstrap (no seed)

When `SEED_DEMO=false`:
- [ ] Only one owner created from `BOOTSTRAP_OWNER_*` env
- [ ] Owner onboards all other users via Team UI

---

## Sign-off checklist (client demo)

Before sharing with client, confirm in one session (~45 min):

1. [ ] Night + Morning themes work on all pages
2. [ ] Owner → Manager → Team login chain works
3. [ ] Task create → assign → status → flag → notification
4. [ ] Leave submit → HR approve → balance update
5. [ ] Billing price → mark billed (accountant)
6. [ ] Team onboarding with temp password
7. [ ] Role restrictions verified (team cannot see billing)
8. [ ] Backend pytest suite green (77/77)

**Notes for open items (confirm with client):**
- Notifications: in-app only (email/push TBD)
- Attachments/SOPs: schema exists; full upload flow not in E2E tests yet
- Recurring tasks: scheduler off by default in production
