"""Department creation and manager assignment."""

from __future__ import annotations


def test_owner_can_create_department_with_manager(client, users):
    owner = users.create("owner")
    manager = users.create("manager")
    resp = client.post(
        "/api/v1/team/departments",
        headers=users.auth_headers(owner),
        json={
            "name": "Team",
            "description": "Execution team",
            "manager_id": str(manager.id),
        },
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["name"] == "Team"
    assert body["manager_id"] == str(manager.id)
    assert body["manager"]["name"] == manager.name


def test_cannot_create_developer_department(client, users):
    owner = users.create("owner")
    resp = client.post(
        "/api/v1/team/departments",
        headers=users.auth_headers(owner),
        json={"name": "Technology"},
    )
    assert resp.status_code == 400
    assert "Owner, Manager, Team, Accounts, HR" in resp.json()["error"]


def test_only_owner_can_create_department(client, users):
    manager = users.create("manager")
    resp = client.post(
        "/api/v1/team/departments",
        headers=users.auth_headers(manager),
        json={"name": "Team", "manager_id": str(manager.id)},
    )
    assert resp.status_code == 403


def test_onboard_with_department_assigns_manager(client, users):
    owner = users.create("owner")
    manager = users.create("manager")
    dept = client.post(
        "/api/v1/team/departments",
        headers=users.auth_headers(owner),
        json={"name": "Team", "manager_id": str(manager.id)},
    ).json()
    resp = client.post(
        "/api/v1/team",
        headers=users.auth_headers(owner),
        json={
            "name": "New Member",
            "email": "newmember@scrumfolks.io",
            "role": "team",
            "department_id": dept["id"],
        },
    )
    assert resp.status_code == 201, resp.text
    user = resp.json()["user"]
    assert user["department"] == "Team"
    assert user["manager_id"] == str(manager.id)


def test_manager_sees_only_own_departments(client, users):
    owner = users.create("owner")
    mgr_a = users.create("manager", email="mgr-a@scrumfolks.io")
    mgr_b = users.create("manager", email="mgr-b@scrumfolks.io")
    client.post(
        "/api/v1/team/departments",
        headers=users.auth_headers(owner),
        json={"name": "Owner", "manager_id": str(mgr_a.id)},
    )
    # Owner + Manager departments - mgr_a only sees ones they manage
    client.post(
        "/api/v1/team/departments",
        headers=users.auth_headers(owner),
        json={"name": "Manager", "manager_id": str(mgr_b.id)},
    )
    listed = client.get(
        "/api/v1/team/departments", headers=users.auth_headers(mgr_a)
    ).json()
    assert len(listed) == 1
    assert listed[0]["name"] == "Owner"


def test_duplicate_department_name_rejected(client, users):
    owner = users.create("owner")
    client.post(
        "/api/v1/team/departments",
        headers=users.auth_headers(owner),
        json={"name": "Accounts"},
    )
    resp = client.post(
        "/api/v1/team/departments",
        headers=users.auth_headers(owner),
        json={"name": "accounts"},
    )
    assert resp.status_code == 409
