"""Brands management (requirements section 4.4)."""

from __future__ import annotations


def _create_brand(client, users, owner, **overrides):
    payload = {"name": "Dinamoo Lighting", "client_type": "Retainer", "priority": "P1"}
    payload.update(overrides)
    return client.post("/api/v1/brands", headers=users.auth_headers(owner), json=payload)


def test_owner_can_create_brand(client, users):
    owner = users.create("owner")
    resp = _create_brand(client, users, owner)
    assert resp.status_code == 201
    assert resp.json()["name"] == "Dinamoo Lighting"


def test_manager_can_create_brand(client, users):
    manager = users.create("manager")
    assert _create_brand(client, users, manager).status_code == 201


def test_team_cannot_create_brand(client, users):
    team = users.create("team")
    assert _create_brand(client, users, team).status_code == 403


def test_team_sees_only_assigned_brands(client, users):
    owner = users.create("owner")
    team = users.create("team")
    _create_brand(client, users, owner, name="Assigned", assigned_members=[str(team.id)])
    _create_brand(client, users, owner, name="Not Assigned")
    brands = client.get("/api/v1/brands", headers=users.auth_headers(team)).json()
    assert {b["name"] for b in brands} == {"Assigned"}


def test_accountant_and_hr_see_all_brands(client, users):
    owner = users.create("owner")
    _create_brand(client, users, owner, name="A")
    _create_brand(client, users, owner, name="B")
    for role in ["accountant", "hr", "manager"]:
        u = users.create(role)
        brands = client.get("/api/v1/brands", headers=users.auth_headers(u)).json()
        assert len(brands) == 2


def test_owner_can_update_brand(client, users):
    owner = users.create("owner")
    brand = _create_brand(client, users, owner).json()
    resp = client.patch(
        f"/api/v1/brands/{brand['id']}",
        headers=users.auth_headers(owner),
        json={"priority": "P2", "short_term_goals": ["Launch portal"]},
    )
    assert resp.status_code == 200
    assert resp.json()["priority"] == "P2"
    assert resp.json()["short_term_goals"] == ["Launch portal"]
