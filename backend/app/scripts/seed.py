"""Seed demo login accounts (and optionally full sample content).

Run after `alembic upgrade head`:

    SEED_PASSWORD='your-demo-password' python -m app.scripts.seed

The 9 demo accounts match the quick-login buttons on the Next.js login
screen. Password is read from SEED_PASSWORD only — never hardcoded here.

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
from app.models.leave import LeaveRequest
from app.models.profile import Profile
from app.models.task import Task


def _u(s: str) -> uuid.UUID:
    return uuid.UUID(s)


OWNER = _u("11111111-0000-0000-0000-000000000001")
PRIYA = _u("11111111-0000-0000-0000-000000000002")
AMIT = _u("11111111-0000-0000-0000-000000000009")

USERS = [
    (OWNER, "Rushabh Shah",  "owner@scrumfolks.com",      "owner",      "Leadership",  "Director",                "RS", None),
    (PRIYA, "Priya Mehta",   "manager@scrumfolks.com",    "manager",    "Creative",    "Creative Manager",        "PM", OWNER),
    (_u("11111111-0000-0000-0000-000000000003"), "Arjun Patel",   "team@scrumfolks.com",       "team",       "Design",      "Senior Designer",         "AP", PRIYA),
    (_u("11111111-0000-0000-0000-000000000004"), "Neha Joshi",    "hr@scrumfolks.com",         "hr",         "HR",          "HR Manager",              "NJ", OWNER),
    (_u("11111111-0000-0000-0000-000000000005"), "Ravi Kumar",    "ravi@scrumfolks.com",       "team",       "Content",     "Content Writer",          "RK", PRIYA),
    (_u("11111111-0000-0000-0000-000000000006"), "Sonal Shah",    "sonal@scrumfolks.com",      "team",       "Social Media","Social Media Executive",  "SS", PRIYA),
    (_u("11111111-0000-0000-0000-000000000007"), "Kavita Rao",    "accountant@scrumfolks.com", "accountant", "Finance",     "Accountant",              "KR", OWNER),
    (_u("11111111-0000-0000-0000-000000000008"), "Dev Sharma",    "dev@scrumfolks.com",        "developer",  "Technology",  "Full Stack Developer",    "DS", PRIYA),
    (AMIT, "Amit Verma",    "amit@scrumfolks.com",       "manager",    "Digital",     "Digital Manager",         "AV", OWNER),
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
        [_u("11111111-0000-0000-0000-000000000003"), _u("11111111-0000-0000-0000-000000000005")],
    ),
    (
        _u("22222222-0000-0000-0000-000000000002"),
        "Ayodhya Group", "AG",
        "Real estate group — residential and commercial projects across Gujarat.",
        "Retainer", "P1",
        ["Q3 lead generation campaign", "New project launch content"],
        ["13,500+ leads pipeline", "350+ deal closures"],
        "Lead gen, hoardings, social media, event management",
        [_u("11111111-0000-0000-0000-000000000003"), _u("11111111-0000-0000-0000-000000000006")],
    ),
    (
        _u("22222222-0000-0000-0000-000000000003"),
        "SmartiQo", "SQ",
        "Smart home automation company based in Ahmedabad.",
        "Retainer", "P2",
        ["Product launch campaign", "Website revamp"],
        ["Market leadership in Gujarat smart home"],
        "Digital marketing, product photography, B2B content, lead gen",
        [_u("11111111-0000-0000-0000-000000000005"), _u("11111111-0000-0000-0000-000000000006")],
    ),
    (
        _u("22222222-0000-0000-0000-000000000004"),
        "Minotti India", "MI",
        "Premium Italian furniture brand for the Indian luxury market.",
        "Project-Based", "P2",
        ["Instagram content calendar", "Brand story reels"],
        ["Premium brand positioning", "10K Instagram followers"],
        "Social media strategy, content creation, campaign management",
        [_u("11111111-0000-0000-0000-000000000003"), _u("11111111-0000-0000-0000-000000000006")],
    ),
    (
        _u("22222222-0000-0000-0000-000000000005"),
        "GESIA ICT", "GE",
        "Gujarat apex ICT industry association.",
        "Retainer", "P3",
        ["GESIA Connect portal launch", "Member newsletter"],
        ["Digital-first member engagement"],
        "Web portal, event content, social media, member communications",
        [_u("11111111-0000-0000-0000-000000000005"), _u("11111111-0000-0000-0000-000000000008")],
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
        _task("Script 3 Reels — Dinamoo", "Write scripts for 3 product reels. Confident, modern.", 0, [4], "Under Review", "High", -1, "Content"),
        _task("Edit 3 Reels — Minotti India", "Edit 3 shoot reels. Upbeat BGM. Subtitles required.", 3, [5], "Struggling", "Medium", -3, "Content"),
        _task("15 Stories — Minotti India", "Design 15 Instagram stories. Luxury tone.", 3, [2], "Not Started", "Medium", 4, "Design", billable=True),
        _task("Ayodhya Q3 Lead Gen Brief", "Plan Q3 lead generation campaign.", 1, [1, 5], "In Progress", "Critical", 0, "Strategy"),
        _task("SmartiQo Website Revamp", "Rebuild marketing site with new IA.", 2, [7], "In Progress", "High", 12, "Development", mode="project", sub_tasks=[
            {"id": str(uuid.uuid4()), "title": "Wireframes", "assigned_to": [str(USERS[7][0])], "status": "Completed", "due_date": (date.today() - timedelta(days=2)).isoformat()},
            {"id": str(uuid.uuid4()), "title": "API integration", "assigned_to": [str(USERS[7][0])], "status": "In Progress", "due_date": (date.today() + timedelta(days=6)).isoformat()},
            {"id": str(uuid.uuid4()), "title": "QA + launch", "assigned_to": [str(USERS[7][0])], "status": "Not Started", "due_date": (date.today() + timedelta(days=11)).isoformat()},
        ]),
        _task("GESIA Member Newsletter", "Write May newsletter draft.", 4, [4], "Needs Attention", "Medium", -1, "Content"),
        _task("Dinamoo Catalogue v2", "Update product catalogue PDF.", 0, [2, 4], "Completed", "Medium", -5, "Design", billable=True),
        _task("Ayodhya New Launch Hoardings", "10 hoarding designs for new launch.", 1, [2], "Revision Needed", "High", 2, "Design"),
        _task("SmartiQo Performance Marketing", "Run May google ads campaign.", 2, [8], "In Progress", "High", 5, "Strategy", billable=True),
    ]


ANNOUNCEMENTS = [
    ("Welcome to Scrumfolks TMS", "Our new internal OS goes live today. Please update your tasks before lunch.", "Important", 0),
    ("Holiday Notice: 2nd Oct", "Office closed for Gandhi Jayanti. Please plan deliveries accordingly.", "Normal", 0),
    ("Q3 Kickoff", "All-hands at 5pm — Dinamoo + Ayodhya progress review.", "Urgent", 1),
]


LEAVES = [
    (4, "Casual", 2, "Family event"),     # Ravi
    (5, "Sick",   1, "Down with flu"),    # Sonal
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


def seed_users_only() -> None:
    """Create demo role accounts only — no brands, tasks, or sample content."""
    if not settings.seed_password or len(settings.seed_password) < 8:
        print("ERROR: Set SEED_PASSWORD (min 8 chars) before running seed.", file=sys.stderr)  # noqa: T201
        raise SystemExit(1)
    with db_session() as db:
        _seed_users(db)
    print("[seed] demo users ready (no sample data)")  # noqa: T201


def seed() -> None:
    if not settings.seed_password or len(settings.seed_password) < 8:
        print("ERROR: Set SEED_PASSWORD (min 8 chars) before running seed.", file=sys.stderr)  # noqa: T201
        raise SystemExit(1)

    with db_session() as db:
        _seed_users(db)

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
