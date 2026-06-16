"""Billing & accounting (requirements section 4.10) — privacy is critical."""

from __future__ import annotations

from datetime import date, timedelta


def _billable_task(client, users, owner):
    return client.post(
        "/api/v1/tasks",
        headers=users.auth_headers(owner),
        json={
            "title": "Billable Campaign",
            "type": "Strategy",
            "priority": "High",
            "is_billable": True,
            "due_date": (date.today() + timedelta(days=5)).isoformat(),
        },
    ).json()


def test_owner_and_accountant_can_set_price(client, users):
    owner = users.create("owner")
    accountant = users.create("accountant")
    task = _billable_task(client, users, owner)
    resp = client.post(
        f"/api/v1/billing/{task['id']}/price",
        headers=users.auth_headers(accountant),
        json={"amount": "15000.00"},
    )
    assert resp.status_code == 200
    assert resp.json()["billable_amount"] == 15000.0


def test_manager_can_set_price(client, users):
    owner = users.create("owner")
    manager = users.create("manager")
    task = _billable_task(client, users, owner)
    resp = client.post(
        f"/api/v1/billing/{task['id']}/price",
        headers=users.auth_headers(manager),
        json={"amount": "15000.00"},
    )
    assert resp.status_code == 200
    assert resp.json()["billable_amount"] == 15000.0


def test_manager_cannot_mark_billed(client, users):
    owner = users.create("owner")
    manager = users.create("manager")
    accountant = users.create("accountant")
    task = _billable_task(client, users, owner)
    client.post(
        f"/api/v1/billing/{task['id']}/price",
        headers=users.auth_headers(accountant),
        json={"amount": "15000.00"},
    )
    resp = client.post(
        f"/api/v1/billing/{task['id']}/mark-billed",
        headers=users.auth_headers(manager),
    )
    assert resp.status_code == 403


def test_team_has_no_billing_access(client, users):
    team = users.create("team")
    assert client.get("/api/v1/billing", headers=users.auth_headers(team)).status_code == 403
    assert client.get("/api/v1/billing/summary", headers=users.auth_headers(team)).status_code == 403


def test_manager_sees_billable_amount_after_setting_price(client, users):
    owner = users.create("owner")
    manager = users.create("manager")
    task = _billable_task(client, users, owner)
    client.post(
        f"/api/v1/billing/{task['id']}/price",
        headers=users.auth_headers(manager),
        json={"amount": "20000.00"},
    )
    rows = client.get("/api/v1/billing", headers=users.auth_headers(manager)).json()
    assert rows[0]["is_billable"] is True
    assert rows[0]["billable_amount"] == 20000.0
    assert rows[0]["has_price"] is True


def test_manager_summary_shows_amounts(client, users):
    owner = users.create("owner")
    manager = users.create("manager")
    accountant = users.create("accountant")
    task = _billable_task(client, users, owner)
    client.post(
        f"/api/v1/billing/{task['id']}/price",
        headers=users.auth_headers(accountant),
        json={"amount": "12000.00"},
    )
    summary = client.get("/api/v1/billing/summary", headers=users.auth_headers(manager)).json()
    assert summary["unpriced"] == 0
    assert summary["total_count"] == 1
    assert float(summary["total_billable"]) == 12000.0


def test_team_never_sees_billable_amount_in_tasks(client, users):
    owner = users.create("owner")
    team = users.create("team")
    accountant = users.create("accountant")
    task = client.post(
        "/api/v1/tasks",
        headers=users.auth_headers(owner),
        json={
            "title": "Secret Billable",
            "type": "Design",
            "priority": "High",
            "is_billable": True,
            "assigned_to": [str(team.id)],
            "due_date": (date.today() + timedelta(days=5)).isoformat(),
        },
    ).json()
    client.post(
        f"/api/v1/billing/{task['id']}/price",
        headers=users.auth_headers(accountant),
        json={"amount": "9999.00"},
    )
    team_view = client.get("/api/v1/tasks", headers=users.auth_headers(team)).json()
    assert team_view[0]["is_billable"] is False
    assert team_view[0]["billable_amount"] is None


def test_mark_billed_requires_price(client, users):
    owner = users.create("owner")
    accountant = users.create("accountant")
    task = _billable_task(client, users, owner)
    # no price yet
    resp = client.post(
        f"/api/v1/billing/{task['id']}/mark-billed",
        headers=users.auth_headers(accountant),
        json={"billed": True},
    )
    assert resp.status_code == 400
    # set price then bill
    client.post(
        f"/api/v1/billing/{task['id']}/price",
        headers=users.auth_headers(accountant),
        json={"amount": "5000.00"},
    )
    ok = client.post(
        f"/api/v1/billing/{task['id']}/mark-billed",
        headers=users.auth_headers(accountant),
        json={"billed": True},
    )
    assert ok.status_code == 200
    assert ok.json()["billed_at"] is not None


def test_billing_summary_math(client, users):
    owner = users.create("owner")
    accountant = users.create("accountant")
    t1 = _billable_task(client, users, owner)
    t2 = _billable_task(client, users, owner)
    client.post(
        f"/api/v1/billing/{t1['id']}/price",
        headers=users.auth_headers(accountant),
        json={"amount": "10000.00"},
    )
    client.post(
        f"/api/v1/billing/{t2['id']}/price",
        headers=users.auth_headers(accountant),
        json={"amount": "5000.00"},
    )
    client.post(
        f"/api/v1/billing/{t1['id']}/mark-billed",
        headers=users.auth_headers(accountant),
        json={"billed": True},
    )
    summary = client.get("/api/v1/billing/summary", headers=users.auth_headers(owner)).json()
    assert float(summary["total_billable"]) == 15000.0
    assert float(summary["billed"]) == 10000.0
    assert float(summary["pending"]) == 5000.0
    assert summary["unpriced"] == 0
