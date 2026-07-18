"""Seed demo login accounts (and optionally full sample content).

Run after `alembic upgrade head`:

    SEED_PASSWORD='your-demo-password' python -m app.scripts.seed

The 6 demo accounts match the quick-login buttons on the Next.js login
screen (one per role). Additional team members are onboarded by Owner/
Manager via the Team module. Password is read from SEED_PASSWORD only.

Default deploy path (`SEED_DEMO=true`, `SEED_FULL_DEMO=false`) creates
accounts only — no brands, tasks, announcements, or leave requests.
Use `seed()` / `SEED_FULL_DEMO=true` only for a populated sales demo.
"""

from __future__ import annotations

import sys
import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select

from app.core.config import settings
from app.core.security import hash_password
from app.db.session import db_session
from app.models.announcement import Announcement
from app.models.brand import Brand
from app.models.department import Department
from app.models.leave import LeaveRequest
from app.models.profile import Profile
from app.models.task import Task


def _u(s: str) -> uuid.UUID:
    return uuid.UUID(s)


OWNER = _u("11111111-0000-0000-0000-000000000001")
MANAGER = _u("11111111-0000-0000-0000-000000000002")
TEAM = _u("11111111-0000-0000-0000-000000000003")
HR = _u("11111111-0000-0000-0000-000000000004")
ACCOUNTANT = _u("11111111-0000-0000-0000-000000000007")

# One account per requirements-doc role for quick demo login.
# Names are role labels — real hires are onboarded via Team by Owner/Manager.
USERS = [
    (OWNER, "Demo Owner",      "owner@scrumfolks.com",      "owner",      "Owner",       "Director",      "OW", None),
    (MANAGER, "Demo Manager",  "manager@scrumfolks.com",    "manager",    "Manager",     "Manager",       "MG", OWNER),
    (TEAM, "Demo Team Member", "team@scrumfolks.com",       "team",       "Team",        "Team Member",   "TM", MANAGER),
    (HR, "Demo HR Manager",  "hr@scrumfolks.com",         "hr",         "HR",          "HR Manager",    "HR", OWNER),
    (ACCOUNTANT, "Demo Accountant", "accountant@scrumfolks.com", "accountant", "Accounts", "Accountant",  "AC", OWNER),
]


BRANDS = [
    (
        _u("22222222-0000-0000-0000-000000000001"),
        "Dinamoo Lighting", "DL",
        "Premium architectural and commercial lighting pole manufacturer based in Raipur, Chhattisgarh.",
        "Retainer", "P1",
        ["Launch dealer portal", "Complete 30 new product listings"],
        ["Achieve 200 dealer network", "Pan-India brand presence"],
        "Social media, dealer content, brochures, photography, digital ads",
        [TEAM],
    ),
    (
        _u("22222222-0000-0000-0000-000000000002"),
        "Ayodhya Group", "AG",
        "Real estate group — residential and commercial projects across Gujarat.",
        "Retainer", "P1",
        ["Q3 lead generation campaign", "New project launch content"],
        ["13,500+ leads pipeline", "350+ deal closures"],
        "Lead gen, hoardings, social media, event management",
        [TEAM],
    ),
    (
        _u("22222222-0000-0000-0000-000000000003"),
        "SmartiQo", "SQ",
        "Smart home automation company based in Ahmedabad.",
        "Retainer", "P2",
        ["Product launch campaign", "Website revamp"],
        ["Market leadership in Gujarat smart home"],
        "Digital marketing, product photography, B2B content, lead gen",
        [TEAM],
    ),
    (
        _u("22222222-0000-0000-0000-000000000004"),
        "Minotti India", "MI",
        "Premium Italian furniture brand for the Indian luxury market.",
        "Project-Based", "P2",
        ["Instagram content calendar", "Brand story reels"],
        ["Premium brand positioning", "10K Instagram followers"],
        "Social media strategy, content creation, campaign management",
        [TEAM],
    ),
    (
        _u("22222222-0000-0000-0000-000000000005"),
        "GESIA ICT", "GE",
        "Gujarat apex ICT industry association.",
        "Retainer", "P3",
        ["GESIA Connect portal launch", "Member newsletter"],
        ["Digital-first member engagement"],
        "Web portal, event content, social media, member communications",
        [TEAM],
    ),
]


def _task(title, desc, brand_idx, assignee_idxs, status_, priority, days_offset, type_, billable=False, mode="standard", sub_tasks=None):
    today = date.today()
    return {
        "id": uuid.uuid4(),
        "title": title,
        "description": desc,
        "brand_id": BRANDS[brand_idx][0],
        "assigned_to": [USERS[i][0] for i in assignee_idxs],
        "assigned_managers": [USERS[1][0]],
        "created_by": USERS[0][0],
        "type": type_,
        "task_mode": mode,
        "priority": priority,
        "status": status_,
        "start_date": today - timedelta(days=2),
        "due_date": today + timedelta(days=days_offset),
        "requires_review": True,
        "is_billable": billable,
        "billable_amount": 15000.00 if billable else None,
        "checklist": [],
        "sub_tasks": sub_tasks or [],
        "timeline": [{"by": str(USERS[0][0]), "action": "Created task", "at": datetime.now(timezone.utc).isoformat()}],
    }


def _all_tasks():
    return [
        _task("Design 10 Static Posts — Dinamoo May", "Create 10 static posts for Dinamoo's May calendar.", 0, [2], "In Progress", "High", 1, "Design", billable=True),
        _task("Script 3 Reels — Dinamoo", "Write scripts for 3 product reels. Confident, modern.", 0, [2], "Under Review", "High", -1, "Content"),
        _task("Edit 3 Reels — Minotti India", "Edit 3 shoot reels. Upbeat BGM. Subtitles required.", 3, [2], "Struggling", "Medium", -3, "Content"),
        _task("15 Stories — Minotti India", "Design 15 Instagram stories. Luxury tone.", 3, [2], "Not Started", "Medium", 4, "Design", billable=True),
        _task("Ayodhya Q3 Lead Gen Brief", "Plan Q3 lead generation campaign.", 1, [1, 2], "In Progress", "Critical", 0, "Strategy"),
        _task("SmartiQo Website Revamp", "Rebuild marketing site with new IA.", 2, [5], "In Progress", "High", 12, "Development", mode="project", sub_tasks=[
            {"id": str(uuid.uuid4()), "title": "Wireframes", "assigned_to": [str(USERS[5][0])], "status": "Completed", "due_date": (date.today() - timedelta(days=2)).isoformat()},
            {"id": str(uuid.uuid4()), "title": "API integration", "assigned_to": [str(USERS[5][0])], "status": "In Progress", "due_date": (date.today() + timedelta(days=6)).isoformat()},
            {"id": str(uuid.uuid4()), "title": "QA + launch", "assigned_to": [str(USERS[5][0])], "status": "Not Started", "due_date": (date.today() + timedelta(days=11)).isoformat()},
        ]),
        _task("GESIA Member Newsletter", "Write May newsletter draft.", 4, [2], "Needs Attention", "Medium", -1, "Content"),
        _task("Dinamoo Catalogue v2", "Update product catalogue PDF.", 0, [2], "Completed", "Medium", -5, "Design", billable=True),
        _task("Ayodhya New Launch Hoardings", "10 hoarding designs for new launch.", 1, [2], "Revision Needed", "High", 2, "Design"),
        _task("SmartiQo Performance Marketing", "Run May google ads campaign.", 2, [5], "In Progress", "High", 5, "Strategy", billable=True),
    ]


ANNOUNCEMENTS = [
    ("Welcome to Scrumfolks TMS", "Our new internal OS goes live today. Please update your tasks before lunch.", "Important", 0),
    ("Holiday Notice: 2nd Oct", "Office closed for Gandhi Jayanti. Please plan deliveries accordingly.", "Normal", 0),
    ("Q3 Kickoff", "All-hands at 5pm — Dinamoo + Ayodhya progress review.", "Urgent", 1),
]


LEAVES = [
    (2, "Casual", 2, "Family event"),     # team demo user
]


def _seed_users(db) -> None:
    """Create/update demo accounts. Manager links are applied in a second pass."""
    existing_by_email = {
        profile.email.lower(): profile for profile in db.scalars(select(Profile)).all()
    }
    password_hash = hash_password(settings.seed_password)
    # Map seed UUID constants to actual profile rows (bootstrap owner may differ).
    id_map: dict[uuid.UUID, uuid.UUID] = {}

    # Pass 1 — ensure every account exists; defer manager_id to avoid FK ordering issues.
    for seed_uid, name, email, role, dept, designation, avatar, _manager in USERS:
        email_key = email.lower()
        if email_key in existing_by_email:
            profile = existing_by_email[email_key]
            profile.password_hash = password_hash
            profile.is_active = True
            profile.name = name
            profile.role = role
            profile.department = dept
            profile.designation = designation
            profile.avatar = avatar
            id_map[seed_uid] = profile.id
            continue

        db.add(
            Profile(
                id=seed_uid,
                name=name,
                email=email_key,
                password_hash=password_hash,
                role=role,
                department=dept,
                designation=designation,
                avatar=avatar,
                manager_id=None,
            )
        )
        db.flush()
        id_map[seed_uid] = seed_uid
        existing_by_email[email_key] = db.get(Profile, seed_uid)  # type: ignore[assignment]

    # Pass 2 — wire reporting hierarchy using resolved DB UUIDs.
    for seed_uid, _name, email, *_rest, seed_manager in USERS:
        profile = existing_by_email[email.lower()]
        resolved_manager = id_map.get(seed_manager) if seed_manager is not None else None
        if profile.manager_id != resolved_manager:
            profile.manager_id = resolved_manager

    db.flush()


def _seed_departments(db, id_map: dict[uuid.UUID, uuid.UUID]) -> None:
    """Ensure the five core departments exist (idempotent sync)."""
    defaults = [
        ("Owner", OWNER, "Executive ownership and strategy"),
        ("Manager", MANAGER, "Delivery and people management"),
        ("Team", MANAGER, "Execution and production"),
        ("Accounts", OWNER, "Billing and finance"),
        ("HR", OWNER, "People operations and leave"),
    ]
    owner_profile_id = id_map.get(OWNER)
    allowed = {name.lower() for name, *_ in defaults}
    by_name = {d.name.lower(): d for d in db.scalars(select(Department)).all()}

    for name, manager_seed, description in defaults:
        manager_profile_id = id_map.get(manager_seed)
        existing = by_name.get(name.lower())
        if existing:
            existing.name = name
            existing.description = description
            existing.manager_id = manager_profile_id or existing.manager_id
        else:
            dept = Department(
                name=name,
                description=description,
                manager_id=manager_profile_id,
                created_by=owner_profile_id,
            )
            db.add(dept)
            by_name[name.lower()] = dept

    # Remove non-canonical departments (e.g. Technology / Design leftovers).
    for dept in list(db.scalars(select(Department)).all()):
        if dept.name.lower() not in allowed:
            db.delete(dept)
    db.flush()


def _retire_developer_role(db) -> None:
    """Developer is not a department/role in the product — map to Team."""
    for profile in db.scalars(select(Profile).where(Profile.role == "developer")).all():
        profile.role = "team"
        profile.department = "Team"
        if not profile.designation or "develop" in profile.designation.lower():
            profile.designation = "Team Member"
    db.flush()


def _build_id_map(db) -> dict[uuid.UUID, uuid.UUID]:
    profiles = {p.email.lower(): p for p in db.scalars(select(Profile)).all()}
    return {
        uid: profiles[email.lower()].id
        for uid, _n, email, *_rest in USERS
        if email.lower() in profiles
    }


def seed_users_only() -> None:
    """Create demo role accounts only — no brands, tasks, or sample content."""
    if not settings.seed_password or len(settings.seed_password) < 8:
        print("ERROR: Set SEED_PASSWORD (min 8 chars) before running seed.", file=sys.stderr)  # noqa: T201
        raise SystemExit(1)
    with db_session() as db:
        _seed_users(db)
        id_map = _build_id_map(db)
        _seed_departments(db, id_map)
        _retire_developer_role(db)
    print("[seed] demo users ready (no sample data)")  # noqa: T201


def seed() -> None:
    if not settings.seed_password or len(settings.seed_password) < 8:
        print("ERROR: Set SEED_PASSWORD (min 8 chars) before running seed.", file=sys.stderr)  # noqa: T201
        raise SystemExit(1)

    with db_session() as db:
        _seed_users(db)
        id_map = _build_id_map(db)
        _seed_departments(db, id_map)
        _retire_developer_role(db)

        existing_brands = set(db.scalars(select(Brand.id)).all())
        for bid, name, logo, desc, ctype, prio, short, long, resp, members in BRANDS:
            if bid in existing_brands:
                continue
            db.add(
                Brand(
                    id=bid,
                    name=name,
                    logo=logo,
                    description=desc,
                    client_type=ctype,
                    priority=prio,
                    short_term_goals=short,
                    long_term_goals=long,
                    responsibilities=resp,
                    assigned_members=members,
                    created_by=USERS[0][0],
                )
            )
        db.flush()

        if not db.scalars(select(Task.id).limit(1)).first():
            for task_data in _all_tasks():
                db.add(Task(**task_data))

        if not db.scalars(select(Announcement.id).limit(1)).first():
            for title, body, priority, creator_idx in ANNOUNCEMENTS:
                db.add(
                    Announcement(
                        title=title,
                        body=body,
                        priority=priority,
                        created_by=USERS[creator_idx][0],
                    )
                )

        if not db.scalars(select(LeaveRequest.id).limit(1)).first():
            today = date.today()
            for user_idx, leave_type, days, reason in LEAVES:
                db.add(
                    LeaveRequest(
                        user_id=USERS[user_idx][0],
                        leave_type=leave_type,
                        start_date=today + timedelta(days=3),
                        end_date=today + timedelta(days=3 + days - 1),
                        days=days,
                        reason=reason,
                        status="Pending",
                    )
                )


if __name__ == "__main__":
    seed()
    print("✓ Seed complete.")  # noqa: T201
