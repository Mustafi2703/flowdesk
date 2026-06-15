"""AI write, cron protection, notifications, and bootstrap (sections 5, 6, 10)."""

from __future__ import annotations


# ── AI Write (section 6) ─────────────────────────────────────────────────────
def test_ai_write_available_to_owner_manager(client, users):
    owner = users.create("owner")
    resp = client.post(
        "/api/v1/ai/task-description",
        headers=users.auth_headers(owner),
        json={"title": "Design festive posts", "type": "Design"},
    )
    assert resp.status_code == 200
    assert resp.json()["description"]  # fallback text when no API key


def test_ai_write_forbidden_for_team(client, users):
    team = users.create("team")
    resp = client.post(
        "/api/v1/ai/task-description",
        headers=users.auth_headers(team),
        json={"title": "X"},
    )
    assert resp.status_code == 403


# ── Cron protection (section 10) ─────────────────────────────────────────────
def test_cron_requires_secret(client):
    resp = client.post("/api/v1/cron/daily-digests")
    assert resp.status_code == 401


def test_cron_with_secret_runs(client):
    from app.core.config import settings

    resp = client.post(
        "/api/v1/cron/daily-digests",
        headers={"X-Cron-Secret": settings.cron_secret},
    )
    assert resp.status_code == 200
    assert "sent" in resp.json()


# ── Notifications (section 5) ────────────────────────────────────────────────
def test_notifications_mark_read(client, users):
    owner = users.create("owner")
    team = users.create("team")
    from datetime import date, timedelta

    client.post(
        "/api/v1/tasks",
        headers=users.auth_headers(owner),
        json={
            "title": "Ping",
            "type": "Design",
            "priority": "Low",
            "assigned_to": [str(team.id)],
            "due_date": (date.today() + timedelta(days=1)).isoformat(),
        },
    )
    notes = client.get("/api/v1/notifications", headers=users.auth_headers(team)).json()
    assert notes
    nid = notes[0]["id"]
    resp = client.post(
        f"/api/v1/notifications/{nid}/read", headers=users.auth_headers(team)
    )
    assert resp.status_code == 200
    assert resp.json()["is_read"] is True


def test_cannot_read_others_notifications(client, users):
    owner = users.create("owner")
    team = users.create("team")
    intruder = users.create("team")
    from datetime import date, timedelta

    client.post(
        "/api/v1/tasks",
        headers=users.auth_headers(owner),
        json={
            "title": "Ping2",
            "type": "Design",
            "priority": "Low",
            "assigned_to": [str(team.id)],
            "due_date": (date.today() + timedelta(days=1)).isoformat(),
        },
    )
    nid = client.get("/api/v1/notifications", headers=users.auth_headers(team)).json()[0]["id"]
    resp = client.post(
        f"/api/v1/notifications/{nid}/read", headers=users.auth_headers(intruder)
    )
    assert resp.status_code == 404


# ── Production bootstrap (no seed) ───────────────────────────────────────────
def test_bootstrap_creates_single_owner_idempotently(db, monkeypatch):
    from app.core.config import settings
    from app.models.profile import Profile
    from app.scripts.bootstrap_admin import bootstrap_admin
    from sqlalchemy import select

    monkeypatch.setattr(settings, "bootstrap_owner_email", "boot-owner@scrumfolks.io")
    monkeypatch.setattr(settings, "bootstrap_owner_password", "BootStrong123!")

    assert bootstrap_admin() is True
    # second run is a no-op (owner already exists)
    assert bootstrap_admin() is False

    owners = db.scalars(select(Profile).where(Profile.role == "owner")).all()
    assert len(owners) == 1
    assert owners[0].email == "boot-owner@scrumfolks.io"


def test_bootstrap_skips_without_password(db, monkeypatch):
    from app.core.config import settings
    from app.models.profile import Profile
    from app.scripts.bootstrap_admin import bootstrap_admin
    from sqlalchemy import select

    monkeypatch.setattr(settings, "bootstrap_owner_email", "nopw@scrumfolks.io")
    monkeypatch.setattr(settings, "bootstrap_owner_password", None)
    assert bootstrap_admin() is False
    assert db.scalars(select(Profile)).first() is None


def test_seed_users_respects_existing_owner_id(db, monkeypatch):
    from app.core.config import settings
    from app.core.security import hash_password
    from app.models.profile import Profile
    from app.scripts.seed import OWNER, PRIYA, USERS, _seed_users
    from sqlalchemy import select

    monkeypatch.setattr(settings, "seed_password", "DemoPass123!")

    owner = Profile(
        name="Rushabh Shah",
        email="owner@scrumfolks.com",
        password_hash=hash_password("BootStrong123!"),
        role="owner",
        department="Leadership",
        designation="Director",
        avatar="RS",
    )
    db.add(owner)
    db.flush()

    _seed_users(db)
    db.commit()

    profiles = {p.email: p for p in db.scalars(select(Profile)).all()}
    assert len(profiles) == len(USERS)
    assert profiles["owner@scrumfolks.com"].id == owner.id
    assert profiles["owner@scrumfolks.com"].id != OWNER
    assert profiles["manager@scrumfolks.com"].manager_id == owner.id
    assert profiles["manager@scrumfolks.com"].id == PRIYA


def test_seed_users_fresh_database(db, monkeypatch):
    from app.core.config import settings
    from app.models.profile import Profile
    from app.scripts.seed import PRIYA, USERS, _seed_users
    from sqlalchemy import select

    monkeypatch.setattr(settings, "seed_password", "DemoPass123!")
    _seed_users(db)
    db.commit()

    profiles = {p.email: p for p in db.scalars(select(Profile)).all()}
    assert len(profiles) == len(USERS)
    owner = profiles["owner@scrumfolks.com"]
    assert profiles["manager@scrumfolks.com"].manager_id == owner.id
    assert profiles["manager@scrumfolks.com"].id == PRIYA
