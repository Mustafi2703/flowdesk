"""Server-side demo login — password never exposed to the client."""

from __future__ import annotations


def test_demo_login_disabled_by_default(client, users, monkeypatch):
    users.create("owner", email="owner@scrumfolks.com", password="DemoPass99!")
    resp = client.post("/api/v1/auth/demo-login", json={"role": "owner"})
    assert resp.status_code == 404


def test_demo_login_works_when_enabled(client, users, monkeypatch):
    from app.core.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "seed_demo", True)
    monkeypatch.setattr(settings, "seed_password", "DemoPass99!")
    users.create("owner", email="owner@scrumfolks.com", password="DemoPass99!")

    resp = client.post("/api/v1/auth/demo-login", json={"role": "owner"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["user"]["role"] == "owner"


def test_demo_login_team_role(client, users, monkeypatch):
    from app.core.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "seed_demo", True)
    monkeypatch.setattr(settings, "seed_password", "DemoPass99!")
    users.create("team", email="team@scrumfolks.com", password="DemoPass99!")

    resp = client.post("/api/v1/auth/demo-login", json={"role": "team"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["user"]["role"] == "team"
    assert body["user"]["email"] == "team@scrumfolks.com"


def test_demo_login_unknown_role(client, monkeypatch):
    from app.core.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "seed_demo", True)
    monkeypatch.setattr(settings, "seed_password", "DemoPass99!")

    resp = client.post("/api/v1/auth/demo-login", json={"role": "ceo"})
    assert resp.status_code == 400
