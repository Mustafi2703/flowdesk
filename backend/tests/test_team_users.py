"""Team management & user onboarding (requirements section 4.5 + role rules)."""

from __future__ import annotations


def test_owner_can_onboard_any_role(client, users):
    owner = users.create("owner")
    for role in ["manager", "team", "hr", "accountant", "developer"]:
        resp = client.post(
            "/api/v1/team",
            headers=users.auth_headers(owner),
            json={"name": f"New {role}", "email": f"new-{role}@scrumfolks.io", "role": role},
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["user"]["role"] == role
        # auto-generated temp password is returned exactly once
        assert body["temporary_password"]


def test_manager_can_onboard_team_and_developer_only(client, users):
    manager = users.create("manager")
    ok = client.post(
        "/api/v1/team",
        headers=users.auth_headers(manager),
        json={"name": "Junior", "email": "junior@scrumfolks.io", "role": "team"},
    )
    assert ok.status_code == 201

    for forbidden in ["owner", "manager", "hr", "accountant"]:
        resp = client.post(
            "/api/v1/team",
            headers=users.auth_headers(manager),
            json={"name": "X", "email": f"x-{forbidden}@scrumfolks.io", "role": forbidden},
        )
        assert resp.status_code == 403, forbidden


def test_team_member_cannot_onboard(client, users):
    team = users.create("team")
    resp = client.post(
        "/api/v1/team",
        headers=users.auth_headers(team),
        json={"name": "X", "email": "x@scrumfolks.io", "role": "team"},
    )
    assert resp.status_code == 403


def test_onboard_with_explicit_password_then_login(client, users):
    owner = users.create("owner")
    resp = client.post(
        "/api/v1/team",
        headers=users.auth_headers(owner),
        json={
            "name": "Set Password",
            "email": "setpw@scrumfolks.io",
            "role": "team",
            "password": "Initial123!",
        },
    )
    assert resp.status_code == 201
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "setpw@scrumfolks.io", "password": "Initial123!"},
    )
    assert login.status_code == 200


def test_duplicate_email_rejected(client, users):
    owner = users.create("owner")
    users.create("team", email="dupe@scrumfolks.io")
    resp = client.post(
        "/api/v1/team",
        headers=users.auth_headers(owner),
        json={"name": "Dupe", "email": "dupe@scrumfolks.io", "role": "team"},
    )
    assert resp.status_code == 409


def test_owner_and_hr_can_reset_password(client, users):
    owner = users.create("owner")
    hr = users.create("hr")
    target = users.create("team", email="resetme@scrumfolks.io")
    # HR resets a team member
    resp = client.post(
        f"/api/v1/team/{target.id}/reset-password", headers=users.auth_headers(hr)
    )
    assert resp.status_code == 200
    new_pw = resp.json()["temporary_password"]
    assert client.post(
        "/api/v1/auth/login",
        json={"email": "resetme@scrumfolks.io", "password": new_pw},
    ).status_code == 200
    # owner can also reset
    assert client.post(
        f"/api/v1/team/{target.id}/reset-password", headers=users.auth_headers(owner)
    ).status_code == 200


def test_hr_cannot_reset_privileged_account(client, users):
    hr = users.create("hr")
    manager = users.create("manager")
    resp = client.post(
        f"/api/v1/team/{manager.id}/reset-password", headers=users.auth_headers(hr)
    )
    assert resp.status_code == 403


def test_only_owner_can_deactivate(client, users):
    owner = users.create("owner")
    manager = users.create("manager")
    target = users.create("team")
    assert client.delete(
        f"/api/v1/team/{target.id}", headers=users.auth_headers(manager)
    ).status_code == 403
    ok = client.delete(f"/api/v1/team/{target.id}", headers=users.auth_headers(owner))
    assert ok.status_code == 200
    # deactivated user can no longer be found by get_current_user / login
    assert client.post(
        "/api/v1/auth/login",
        json={"email": target.email, "password": "Passw0rd!"},
    ).status_code == 401


def test_owner_can_reactivate(client, users):
    owner = users.create("owner")
    target = users.create("team", is_active=False)
    resp = client.post(
        f"/api/v1/team/{target.id}/activate", headers=users.auth_headers(owner)
    )
    assert resp.status_code == 200
    assert resp.json()["ok"] is True


def test_team_module_restricted_to_owner_manager_hr(client, users):
    for role, allowed in [
        ("owner", True),
        ("manager", True),
        ("hr", True),
        ("team", False),
        ("accountant", False),
        ("developer", False),
    ]:
        user = users.create(role)
        resp = client.get("/api/v1/team", headers=users.auth_headers(user))
        assert (resp.status_code == 200) == allowed, role


def test_assignable_roles_endpoint(client, users):
    owner = users.create("owner")
    manager = users.create("manager")
    owner_roles = client.get(
        "/api/v1/team/assignable-roles", headers=users.auth_headers(owner)
    ).json()["roles"]
    manager_roles = client.get(
        "/api/v1/team/assignable-roles", headers=users.auth_headers(manager)
    ).json()["roles"]
    assert set(manager_roles) == {"team", "developer"}
    assert "owner" in owner_roles


def test_workload_calculation(client, users):
    owner = users.create("owner")
    team = users.create("team")
    from datetime import date, timedelta

    for i in range(3):
        client.post(
            "/api/v1/tasks",
            headers=users.auth_headers(owner),
            json={
                "title": f"Task {i}",
                "type": "Design",
                "priority": "Medium",
                "assigned_to": [str(team.id)],
                "due_date": (date.today() + timedelta(days=2)).isoformat(),
            },
        )
    rows = client.get("/api/v1/team/workload", headers=users.auth_headers(owner)).json()
    row = next(r for r in rows if r["user"]["id"] == str(team.id))
    assert row["active_tasks"] == 3
    assert row["workload"] == "Fully Loaded"
