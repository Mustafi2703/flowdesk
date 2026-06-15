"""Personal / team / company calendar."""

from __future__ import annotations

from datetime import date, timedelta


def test_employee_sees_own_calendar(client, users):
    team = users.create("team")
    month = date.today().strftime("%Y-%m")
    resp = client.get(f"/api/v1/calendar?month={month}", headers=users.auth_headers(team))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["user"]["id"] == str(team.id)
    assert body["scope"] == "personal"
    assert len(body["viewable_users"]) == 1


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
