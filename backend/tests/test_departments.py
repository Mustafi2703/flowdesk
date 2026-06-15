"""Department creation and manager assignment."""

from __future__ import annotations


def test_owner_can_create_department_with_manager(client, users):
    owner = users.create("owner")
    manager = users.create("manager")
    resp = client.post(
        "/api/v1/team/departments",
        headers=users.auth_headers(owner),
        json={
            "name": "Design",
            "description": "Creative team",
            "manager_id": str(manager.id),
        },
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["name"] == "Design"
    assert body["manager_id"] == str(manager.id)
    assert body["manager"]["name"] == manager.name


def test_only_owner_can_create_department(client, users):
    manager = users.create("manager")
    resp = client.post(
        "/api/v1/team/departments",
        headers=users.auth_headers(manager),
        json={"name": "Ops", "manager_id": str(manager.id)},
    )
    assert resp.status_code == 403


def test_onboard_with_department_assigns_manager(client, users):
    owner = users.create("owner")
    manager = users.create("manager")
    dept = client.post(
        "/api/v1/team/departments",
        headers=users.auth_headers(owner),
        json={"name": "Technology", "manager_id": str(manager.id)},
    ).json()
    resp = client.post(
        "/api/v1/team",
        headers=users.auth_headers(owner),
        json={
            "name": "New Dev",
            "email": "newdev@scrumfolks.io",
            "role": "developer",
            "department_id": dept["id"],
        },
    )
    assert resp.status_code == 201, resp.text
    user = resp.json()["user"]
    assert user["department"] == "Technology"
    assert user["manager_id"] == str(manager.id)


def test_manager_sees_only_own_departments(client, users):
    owner = users.create("owner")
    mgr_a = users.create("manager", email="mgr-a@scrumfolks.io")
    mgr_b = users.create("manager", email="mgr-b@scrumfolks.io")
    client.post(
        "/api/v1/team/departments",
        headers=users.auth_headers(owner),
        json={"name": "Dept A", "manager_id": str(mgr_a.id)},
    )
    client.post(
        "/api/v1/team/departments",
        headers=users.auth_headers(owner),
        json={"name": "Dept B", "manager_id": str(mgr_b.id)},
    )
    listed = client.get(
        "/api/v1/team/departments", headers=users.auth_headers(mgr_a)
    ).json()
    assert len(listed) == 1
    assert listed[0]["name"] == "Dept A"


def test_duplicate_department_name_rejected(client, users):
    owner = users.create("owner")
    client.post(
        "/api/v1/team/departments",
        headers=users.auth_headers(owner),
        json={"name": "Finance"},
    )
    resp = client.post(
        "/api/v1/team/departments",
        headers=users.auth_headers(owner),
        json={"name": "finance"},
    )
    assert resp.status_code == 409
