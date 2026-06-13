"""Personal / team calendar."""

from __future__ import annotations

from datetime import date


def test_employee_sees_own_calendar(client, users):
    team = users.create("team")
    month = date.today().strftime("%Y-%m")
    resp = client.get(f"/api/v1/calendar?month={month}", headers=users.auth_headers(team))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["user"]["id"] == str(team.id)
    assert isinstance(body["days"], dict)


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
