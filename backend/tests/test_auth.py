"""Authentication & session (requirements section 9)."""

from __future__ import annotations


def test_login_success_sets_cookie_and_returns_user(client, users):
    user = users.create("owner", email="login-owner@scrumfolks.io", password="Sup3rSecret!")
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": "login-owner@scrumfolks.io", "password": "Sup3rSecret!"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["user"]["email"] == "login-owner@scrumfolks.io"
    assert body["user"]["role"] == "owner"
    assert "access_token" in body
    # HttpOnly session cookie is set.
    assert "sf_sess" in resp.cookies


def test_login_wrong_password_rejected(client, users):
    users.create("team", email="wrong@scrumfolks.io", password="Right0nePass!")
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": "wrong@scrumfolks.io", "password": "BadPassword1"},
    )
    assert resp.status_code == 401
    assert resp.json()["error"]


def test_inactive_user_cannot_login(client, users):
    users.create("team", email="inactive@scrumfolks.io", password="Right0nePass!", is_active=False)
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": "inactive@scrumfolks.io", "password": "Right0nePass!"},
    )
    assert resp.status_code == 401


def test_me_requires_auth(client):
    assert client.get("/api/v1/auth/me").status_code == 401


def test_me_returns_current_user(client, users):
    user = users.create("manager")
    resp = client.get("/api/v1/auth/me", headers=users.auth_headers(user))
    assert resp.status_code == 200
    assert resp.json()["role"] == "manager"


def test_change_password_then_login_with_new(client, users):
    user = users.create("team", email="chg@scrumfolks.io", password="OldPass123!")
    headers = users.auth_headers(user)
    resp = client.post(
        "/api/v1/auth/change-password",
        headers=headers,
        json={"current_password": "OldPass123!", "new_password": "BrandNew456!"},
    )
    assert resp.status_code == 200
    # Old password fails, new password works.
    assert client.post(
        "/api/v1/auth/login",
        json={"email": "chg@scrumfolks.io", "password": "OldPass123!"},
    ).status_code == 401
    assert client.post(
        "/api/v1/auth/login",
        json={"email": "chg@scrumfolks.io", "password": "BrandNew456!"},
    ).status_code == 200


def test_change_password_wrong_current_rejected(client, users):
    user = users.create("team", password="OldPass123!")
    resp = client.post(
        "/api/v1/auth/change-password",
        headers=users.auth_headers(user),
        json={"current_password": "nope", "new_password": "BrandNew456!"},
    )
    assert resp.status_code == 400


def test_security_headers_present(client):
    resp = client.get("/health")
    assert resp.headers.get("X-Content-Type-Options") == "nosniff"
    assert resp.headers.get("X-Frame-Options") == "DENY"
