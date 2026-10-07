"""Personal / team / company calendar."""

from __future__ import annotations

from datetime import date, timedelta


def _create_task(client, headers, **kwargs):
    payload = {
        "title": kwargs.get("title", "Cal task"),
        "assigned_to": kwargs.get("assigned_to", []),
        "assigned_managers": kwargs.get("assigned_managers", []),
        "due_date": kwargs.get("due_date"),
        "start_date": kwargs.get("start_date"),
        "priority": "Medium",
        "status": "Not Started",
    }
    return client.post("/api/v1/tasks", headers=headers, json=payload)


def test_employee_sees_own_calendar(client, users):
    team = users.create("team")
    month = date.today().strftime("%Y-%m")
    resp = client.get(f"/api/v1/calendar?month={month}", headers=users.auth_headers(team))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["user"]["id"] == str(team.id)
    assert body["scope"] == "personal"
    assert len(body["viewable_users"]) == 1


def test_employee_sees_assigned_task_on_due_date(client, users):
    owner = users.create("owner")
    team = users.create("team")
    due = date.today()
    month = due.strftime("%Y-%m")
    created = _create_task(
        client,
        users.auth_headers(owner),
        title="Due today",
        assigned_to=[str(team.id)],
        due_date=due.isoformat(),
    )
    assert created.status_code in (200, 201), created.text
    task_id = created.json()["id"]
    resp = client.get(f"/api/v1/calendar?month={month}", headers=users.auth_headers(team))
    assert resp.status_code == 200, resp.text
    day = resp.json()["days"].get(due.isoformat(), {})
    ids = [t["id"] for t in day.get("tasks", [])]
    assert task_id in ids


def test_manager_sees_managed_task_on_calendar(client, users):
    owner = users.create("owner")
    manager = users.create("manager")
    team = users.create("team")
    due = date.today() + timedelta(days=2)
    month = due.strftime("%Y-%m")
    created = _create_task(
        client,
        users.auth_headers(owner),
        title="Managed desk",
        assigned_to=[str(team.id)],
        assigned_managers=[str(manager.id)],
        due_date=due.isoformat(),
    )
    assert created.status_code in (200, 201), created.text
    task_id = created.json()["id"]
    resp = client.get(f"/api/v1/calendar?month={month}", headers=users.auth_headers(manager))
    assert resp.status_code == 200, resp.text
    day = resp.json()["days"].get(due.isoformat(), {})
    ids = [t["id"] for t in day.get("tasks", [])]
    assert task_id in ids


def test_manager_can_view_report_calendar(client, users):
    manager = users.create("manager")
    report = users.create("team", manager_id=manager.id)
    month = date.today().strftime("%Y-%m")
    resp = client.get(
        f"/api/v1/calendar?month={month}&user_id={report.id}",
        headers=users.auth_headers(manager),
    )
    assert resp.status_code == 200
    assert resp.json()["user"]["id"] == str(report.id)


def test_team_cannot_view_other_calendar(client, users):
    a = users.create("team")
    b = users.create("team")
    month = date.today().strftime("%Y-%m")
    resp = client.get(
        f"/api/v1/calendar?month={month}&user_id={b.id}",
        headers=users.auth_headers(a),
    )
    assert resp.status_code == 403


def test_owner_company_calendar(client, users):
    owner = users.create("owner")
    month = date.today().strftime("%Y-%m")
    resp = client.get(
        f"/api/v1/calendar?month={month}&scope=company",
        headers=users.auth_headers(owner),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["scope"] == "company"
    assert body["user"]["id"] == "company"
    assert body["viewable_users"][0]["id"] == "company"


def test_hr_can_view_any_employee_calendar(client, users):
    hr = users.create("hr")
    team = users.create("team")
    month = date.today().strftime("%Y-%m")
    resp = client.get(
        f"/api/v1/calendar?month={month}&user_id={team.id}",
        headers=users.auth_headers(hr),
    )
    assert resp.status_code == 200
    assert resp.json()["user"]["id"] == str(team.id)
    assert len(resp.json()["viewable_users"]) >= 2


def test_non_owner_cannot_view_company_calendar(client, users):
    manager = users.create("manager")
    month = date.today().strftime("%Y-%m")
    resp = client.get(
        f"/api/v1/calendar?month={month}&scope=company",
        headers=users.auth_headers(manager),
    )
    assert resp.status_code == 403
