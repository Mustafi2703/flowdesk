# Scrumfolks TMS — Spec readiness (document prep / review)

Mapped against **Scrumfolks TMS Project Specification v2** and **Updates.md**.
Use this for client document prep and pre-review walkthroughs.

Legend: **Ready** = shipped in product · **Partial** = works with known limits · **Gap** = not built / phase later

---

## Module readiness

| Spec area | Status | Notes for review |
|-----------|--------|------------------|
| Auth + roles (Owner / Manager / Team / HR / Accounts) | Ready | JWT session; Accountant = finance price access |
| Task CRUD, multi-assign, priorities, statuses | Ready | List + filters; Kanban/calendar partial |
| Assigned by (who assigned) | Ready | Stored on create/re-assign; shown in Tasks + Updates |
| Task chat / Updates channels | Ready | Brand filter, docs per task, close & purge when done |
| Close Updates when task done | Ready | Owner/Manager close + purge chat; auto-close on mgmt Complete |
| File upload + in-app viewer | Ready | Tasks + brands; review queue; up to **100 MB** |
| Brand profile + kit + docs | Ready | Logo, fonts, colors, voice, goals, journey, files |
| Brand team allocation | Ready | Dropdown PeoplePicker; assigned get brand access |
| Review queue (files) | Ready | `/review` for Owner/Manager |
| Team / multi-manager | Ready | `manager_ids`; owner email change, deactivate, hard delete |
| Attendance clock-in (team) | Ready | Owner/HR see team reports |
| Leave request + approval | Ready | Role-gated |
| Performance dashboards | Ready | Team self-view; owner/manager team metrics |
| Workflow (brand stages) board | Ready | `/devboard` |
| Dashboard notifications | Ready | Per-user unread on overview |
| Direct messaging (team ↔ manager) | Gap | Spec §5.2 — not in v1 |
| Email OTP / forgot password | Gap | Spec §1 — login password only today |
| File auto-delete lifecycle + trash | Partial | Columns exist; UI/cron not full |
| Virus scan / S3 signed URLs | Gap | DB/disk storage on Railway today |
| PDF/CSV performance export | Gap | Spec §6.2 |
| Rich text editor | Partial | Plain textareas |
| Custom domain tasks.scrumfolks.com | Ops | Point DNS to Railway when ready |

---

## Updates.md checklist

| # | Item | Status |
|---|------|--------|
| 1–2 | Team/owner performance metrics | Ready |
| 3 | No Brand → name / project | Partial — verify create flow |
| 4 | Workflow HTML + price Owner/Accountant only | Ready |
| 5 | Dashboard + file upload tasks/brands | Ready |
| 6 | Brand kit + docs + reviewable | Ready |
| 7 | Team member task modal | Ready |
| 8 | Priority/status on dashboards | Ready |
| 9 | Owner attendance = team report | Ready |
| 10 | Review tab + assigned-by tag + email/delete user | Ready |
| 11 | Multi-manager | Ready |

---

## Document prep tips (client review)

1. **Demo path:** Owner login → Brands (assign team) → Tasks (note Assigned by) → Updates (chat + docs) → Complete task → **Close & purge chat** → Review files.
2. **Roles to demo:** Owner, Manager, Team, HR, Accountant (price only for Owner/Accountant).
3. **Call out Gaps** above so the spec review does not treat Phase-6 items (DMs, email digests, S3) as missing bugs.
4. **Storage story:** Closing Updates on done tasks deletes chat rows; attachments stay until Review/delete/auto-delete policy is finished.
5. **Migration required on deploy:** `0008_assigned_by_updates_closed` (assigned_by + updates_closed).

---

## Storage note (not building yet)

Document management is **live** (DB-backed uploads + in-app viewer). Cloudflare R2 can be wired later when the client finalizes storage — no change required for current demos.


| Role | View brands | Edit brand | Assign managers | Assign team | Upload docs |
|------|-------------|------------|-----------------|-------------|-------------|
| Owner | All | Yes | Yes | Yes | Yes |
| Manager | All | Yes | No | Yes | Yes |
| Team | Allocated only | No | No | No | Yes (if allocated) |
| HR | All (read-only) | No | No | No | No |
| Accountant | All (read-only) | No | No | No | No |

Allocated = `assigned_managers` ∪ `assigned_members`. Docs visible to all who can view the brand.
