"""Announcements (requirements section 4.9)."""

from __future__ import annotations


def test_owner_can_post_and_all_users_notified(client, users):
    owner = users.create("owner")
    team = users.create("team")
    hr = users.create("hr")
    resp = client.post(
        "/api/v1/announcements",
        headers=users.auth_headers(owner),
        json={"title": "All Hands", "body": "5pm today", "priority": "Urgent"},
    )
    assert resp.status_code == 201
    assert resp.json()["priority"] == "Urgent"
    assert resp.json()["creator"]["name"] == owner.name
    # Every active user gets a notification.
    for u in (team, hr):
        notes = client.get("/api/v1/notifications", headers=users.auth_headers(u)).json()
        assert any("announcement" in (n["message"] or "").lower() for n in notes)


def test_manager_can_post(client, users):
    manager = users.create("manager")
    resp = client.post(
        "/api/v1/announcements",
        headers=users.auth_headers(manager),
        json={"title": "Note", "body": "FYI"},
    )
    assert resp.status_code == 201


def test_team_cannot_post(client, users):
    team = users.create("team")
    resp = client.post(
        "/api/v1/announcements",
        headers=users.auth_headers(team),
        json={"title": "Note", "body": "FYI"},
    )
    assert resp.status_code == 403


def test_all_roles_can_view(client, users):
    owner = users.create("owner")
    client.post(
        "/api/v1/announcements",
        headers=users.auth_headers(owner),
        json={"title": "Visible", "body": "to everyone"},
    )
    for role in ["team", "developer", "accountant", "hr", "manager"]:
        u = users.create(role)
        resp = client.get("/api/v1/announcements", headers=users.auth_headers(u))
        assert resp.status_code == 200
        assert any(a["title"] == "Visible" for a in resp.json())


def test_mark_read_tracks_user(client, users):
    owner = users.create("owner")
    team = users.create("team")
    ann = client.post(
        "/api/v1/announcements",
        headers=users.auth_headers(owner),
        json={"title": "Read me", "body": "please"},
    ).json()
    resp = client.patch(
        f"/api/v1/announcements/{ann['id']}/read", headers=users.auth_headers(team)
    )
    assert resp.status_code == 200
    assert str(team.id) in resp.json()["read_by"]
