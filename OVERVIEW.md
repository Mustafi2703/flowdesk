# FlowDesk — product overview

This document describes **what FlowDesk is and how it behaves**, based on the original in-browser prototype you shared (team roster, task lifecycle, manager vs assignee actions, and UI structure). The shipped app keeps the same product behavior; tasks are persisted with **PostgreSQL** via API routes instead of living only in React state.

---

## What FlowDesk is

FlowDesk is an **internal task desk** branded as **“Scrumfolks OS”**. It lets people pick who they are from the team list, then **see tasks, move them through a review workflow, and (for managers) assign new work**. It is aimed at creative/marketing operations: work is tagged by **client brand**, **priority**, and **due date**, with a visible **activity timeline** on each task.

---

## Who uses it

### Team directory

Everyone appears on a **login** screen grouped by **department** (Leadership, Account, Marketing, Design, Content, Video, AI, Brand, Dev). Each person has:

- **Name** and **role label** (e.g. Director, Sr. Designer, Content Strategist).
- **Avatar initials** and a **department color**.
- **“MGR”** badge for people who can **assign tasks and run reviews** (managers in the original data model).

### Managers vs everyone else

| Capability | Managers (`canAssign: true`) | Team (`canAssign: false`) |
|------------|------------------------------|---------------------------|
| Pick profile and sign in | Yes | Yes |
| **My Tasks** view | Shows **all tasks** (“All Tasks Overview”) | Shows only tasks **assigned to them** |
| **Review Queue** | Yes — work waiting for approval / issues | Hidden |
| **Assign Tasks** | Yes — create tasks for others | Hidden |
| **All Tasks** | Yes — tasks grouped by assignee | Hidden |
| Act on a task as **assignee** | Only if the task is assigned to them (managers are not shown assignee-only actions in the prototype when they are also “manager” profile) | Start, submit, issue, re-submit |

There is **no password or SSO** in the prototype: anyone with the URL can impersonate any profile. The same applies until you add real authentication.

---

## What a “task” is

Each task includes:

- **Title** and optional **description** (brief for the assignee).
- **Brand** — chosen from a fixed list of client names (e.g. Dinamoo, Scrumfolks, Minotti Ahmedabad).
- **Assignee** and **assigner** (team member ids).
- **Priority** — Low, Medium, High, Urgent (with distinct colors in the UI).
- **Due date** — shown in lists and the detail panel; overdue styling when past due and not closed.
- **Status** — see lifecycle below.
- **Created date** and **timeline** — append-only log of who did what and when, with optional **notes** on key events.

---

## Task status lifecycle

Intended flow in the original copy:

```text
assigned → in_progress → submitted → reviewed → closed
                    ↘ issue ↗        ↑
                         (manager can approve from issue)
                    changes ← (manager requests revisions)
                         ↓
                    in_progress / submitted again
```

**Statuses and meanings (UI labels):**

| Status | Meaning |
|--------|--------|
| **assigned** | Created and waiting for the assignee to start. |
| **in_progress** | Assignee started work. |
| **submitted** | Assignee sent work for review (note required). |
| **issue** | Assignee blocked or escalated (note required). |
| **changes** | Manager asked for revisions (note required). |
| **reviewed** | Manager approved; ready to close. |
| **closed** | Manager closed the task; no further actions. |

**Timeline** entries use human-readable action text (e.g. “Assigned task”, “Started work”, “Submitted for review”, “Raised issue”, “Reviewed & approved”, “Requested changes”, “Closed task”).

---

## Actions from the task detail panel

### Assignee (non-manager UI)

- **Start** — from `assigned` → `in_progress`.
- **Submit for review** — from `in_progress` or `changes` → `submitted` (**note required**).
- **Raise issue** — from `in_progress` or `changes` → `issue` (**note required**).
- **Re-submit** — from `issue` → `submitted` (**note required**).

### Manager

- **Approve** — from `submitted` or `issue` → `reviewed` (optional review note; default text if empty).
- **Request changes** — from `submitted` or `issue` → `changes` (**note required**).
- **Close task** — from `reviewed` → `closed` (optional note).
- **Acknowledge issue** — same as approve from `issue` in the prototype (moves toward `reviewed`).

Closed tasks show a simple “task has been closed” message; the action strip is hidden.

---

## Main screens (after login)

1. **My Tasks** — Filters: **status** and **brand**. Tasks are grouped into **sections by status** (only sections that have tasks are shown). Cards show title, status chip, brand, priority, assignee (for managers), due date, and last timeline action when relevant.

2. **Review Queue** (managers only) — Tabs: **Needs review** (`submitted`), **Issues raised** (`issue`), **Reviewed** (`reviewed`). Badge counts on nav where applicable.

3. **Assign Tasks** (managers only) — Form: title, description, assignee (non-managers only in the dropdown), brand, priority, due date. **Recently assigned** lists tasks the current manager created.

4. **All Tasks** (managers only) — Filter by status. Tasks **grouped by team member** (non-managers), with small per-status count chips per person.

Clicking a card opens a **right-hand detail drawer** with full metadata, full timeline, notes field, and allowed actions.

---

## Design and tone

Dark theme (`#04070e` style background), **Figtree** and **Cabinet Grotesk** fonts, department colors on avatars and accents, compact chips for status and priority. The experience is meant to feel like a small **internal OS** for the agency, not a generic ticket tool.

---

## How the codebase you have now relates to this

- **Behavior and copy** above match the **React prototype** you pasted (team data, brands, priorities, statuses, views, and buttons).
- **Persistence**: the prototype used `useState` and in-memory seed data. The **Next.js app** loads and saves tasks through **`/api/tasks`** and **Prisma + PostgreSQL** so multiple devices and deploys share one database.
- **Seeding**: the same **seven example tasks** from the prototype can be loaded into Postgres with `npm run db:seed` once the database exists.

For **deploying** (Vercel + Railway), see **`DEPLOYMENT.md`**. For **creating Postgres on Railway for the first time**, that file now includes a dedicated **Railway PostgreSQL** section at the top.
