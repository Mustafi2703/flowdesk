# Scrumfolks TMS — UAT checklist (Oct 2026)

Use this sheet so every role can sign off the latest release before client handoff.

**App:** https://tasks.sfolks.com (also https://frontend-production-c885.up.railway.app)  
**Sign-in:** email + password only (no demo role buttons).  
**Rule:** Team must **clock in** before changing task status / progress / review.

Mark each row **Pass / Fail / N/A** and note the tester name + date at the bottom.

---

## 0. Prep (Owner, 5 min)

| # | Step | Pass? |
|---|------|-------|
| 0.1 | Confirm Railway frontend + backend both deployed the latest `main` | |
| 0.2 | Have accounts ready: Owner, Manager, Team, HR, Accountant (or Developer) | |
| 0.3 | Pick one real brand and one team member for assignment tests | |
| 0.4 | Create a scratch recurring task titled `UAT Recurring — Weekly` (frequency Weekly, due today, assigned to Team, review off) | |

---

## 1. Dashboard (all roles)

| # | Role | Expect | Pass? |
|---|------|--------|-------|
| 1.1 | Owner | Metrics row (Open / In progress / Due today / Overdue / In review). Left = all open tasks (non-recurring). Right stack = **Recurring** panel above **Updates** | |
| 1.2 | Manager / Team | Same layout, but lists only **their desk** (assigned / managed), not company-wide | |
| 1.3 | All | Recurring panel has accent highlight; each row shows brand, title, frequency badge, next due | |
| 1.4 | All | Recurring tasks do **not** duplicate in the left “Tasks” list | |
| 1.5 | All | Clicking a recurring row opens that task; “View all →” goes to `/tasks` | |
| 1.6 | All | Updates list shows brand name first; click opens Updates for that task | |
| 1.7 | All | Clock in / out from the top clock bar works; hours today update | |
| 1.8 | Owner / Manager | “Email & Drive ops” toggle shows email + Drive controls | |

---

## 2. Recurring tasks — create & visibility

| # | Role | Step | Expect | Pass? |
|---|------|------|--------|-------|
| 2.1 | Owner / Manager | New task → enable **Recurring Task** → pick Daily / Weekly / Monthly / Yearly → save | Task appears with orange recurring badge | |
| 2.2 | Owner | Dashboard Recurring panel | New task listed for Owner | |
| 2.3 | Assigned Team | Dashboard + Tasks | Sees the recurring task on their desk only | |
| 2.4 | Unrelated Team | Dashboard + Tasks | Does **not** see that recurring task | |
| 2.5 | All | Tasks → **List** view | Recurring block **above** “Other tasks”, tinted rows + frequency badge | |
| 2.6 | All | Tasks → **Board** view | Recurring cards have accent edge + frequency badge | |

---

## 3. Recurring — spawn on complete (critical)

Do this with the scratch task `UAT Recurring — Weekly` (or a copy). Note the task id / title before completing.

| # | Step | Expect | Pass? |
|---|------|--------|-------|
| 3.1 | Clock in as Owner (or Manager with rights) | Can change status | |
| 3.2 | Open recurring task → set status **Completed** (review **off**) | Status Completed | |
| 3.3 | Refresh Tasks / Dashboard | Old task no longer in Recurring panel (cycle disabled) | |
| 3.4 | Find the **new** open task with the same title | Status **Not Started**, due date = old due + 1 week | |
| 3.5 | New task shows as Recurring (enabled) on dashboard + list + board | Badge + separated section | |
| 3.6 | Complete the **old** completed task again (if editable) | Must **not** create a second child | |

### 3b. Spawn on review approve

| # | Step | Expect | Pass? |
|---|------|--------|-------|
| 3.7 | Create recurring task with **Requires review** on, assign Team | Visible to Team | |
| 3.8 | Team clocks in → moves to Under Review (upload / status path as usual) | In Review column | |
| 3.9 | Owner/Manager **Approve** review | Parent Completed; new open occurrence spawned with advanced due date | |

---

## 4. Tasks board & modal

| # | Step | Expect | Pass? |
|---|------|--------|-------|
| 4.1 | Board fills the page; many cards visible without a tiny fixed height | | |
| 4.2 | New task / Edit modal is near full-screen, two-column form | | |
| 4.3 | Status change blocked when not clocked in (Team) | Clear hint | |
| 4.4 | Owner/Manager can set billable + amount; Manager/Team never see ₹ amounts they shouldn’t | Prices Owner + Accountant only | |

---

## 5. Updates

| # | Step | Expect | Pass? |
|---|------|--------|-------|
| 5.1 | Thread list shows **brand name first**, then task title | | |
| 5.2 | Owner/Manager can **Close** a chat thread | Thread closed; history kept | |
| 5.3 | Close does **not** delete messages | Reopen still shows history | |
| 5.4 | Deep link `/updates?task=…` opens the right thread | | |

---

## 6. Calendar

| # | Step | Expect | Pass? |
|---|------|--------|-------|
| 6.1 | Owner sees company tasks with due/start dates | | |
| 6.2 | Team/Manager see personal assignee/manager tasks | | |
| 6.3 | Clicking a calendar item opens the task | | |
| 6.4 | Mobile / narrow width usable | | |

---

## 7. Attendance & roles smoke

| # | Role | Expect | Pass? |
|---|------|--------|-------|
| 7.1 | Team | Clock in → work → clock out; attendance log shows times | |
| 7.2 | Owner/Manager | Attendance report shows who is in now | |
| 7.3 | HR | People / leave modules load; no billing edit | |
| 7.4 | Accountant | Billing + prices visible; no team admin | |
| 7.5 | All | Forbidden sidebar items hidden; direct URL to forbidden page fails/redirects | |

---

## 8. Regression “whole system” quick pass (Owner, 10 min)

| # | Module | Smoke | Pass? |
|---|--------|-------|-------|
| 8.1 | Brands | Open a brand; tasks filter by brand | |
| 8.2 | Team | User list loads | |
| 8.3 | Notifications | Completing / assigning creates a notification | |
| 8.4 | Login | Logout → login with email/password | |
| 8.5 | Theme | Morning / Night toggle persists after refresh | |

---

## Sign-off

| Role | Tester name | Date | Result (Pass / Fail) | Notes |
|------|-------------|------|----------------------|-------|
| Owner | | | | |
| Manager | | | | |
| Team | | | | |
| HR | | | | |
| Accountant | | | | |

**Release blocker:** any Fail in §3 (spawn) or §1 (wrong role scope) must be fixed before client demo.

**How to report a fail:** screenshot + role + URL + steps + expected vs actual. Prefer one Linear/issue or WhatsApp thread titled `UAT fail — <section>`.
