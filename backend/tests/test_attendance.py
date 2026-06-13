"""Attendance management (requirements section 4.7)."""

from __future__ import annotations


def test_clock_in_then_out_calculates_hours(client, users):
    team = users.create("team")
    headers = users.auth_headers(team)
    cin = client.post("/api/v1/attendance/clockin", headers=headers)
    assert cin.status_code == 200
    assert cin.json()["login_time"] is not None
    cout = client.post("/api/v1/attendance/clockout", headers=headers)
    assert cout.status_code == 200
    assert cout.json()["logout_time"] is not None
    assert cout.json()["hours_worked"] >= 0


def test_clock_out_without_in_rejected(client, users):
    team = users.create("team")
    resp = client.post("/api/v1/attendance/clockout", headers=users.auth_headers(team))
    assert resp.status_code == 400


def test_one_session_per_day(client, users):
    team = users.create("team")
    headers = users.auth_headers(team)
    client.post("/api/v1/attendance/clockin", headers=headers)
    client.post("/api/v1/attendance/clockin", headers=headers)
    logs = client.get("/api/v1/attendance", headers=headers).json()
    assert len(logs) == 1


def test_admin_can_view_others_attendance(client, users):
    hr = users.create("hr")
    team = users.create("team")
    client.post("/api/v1/attendance/clockin", headers=users.auth_headers(team))
    resp = client.get(
        f"/api/v1/attendance?user_id={team.id}", headers=users.auth_headers(hr)
    )
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_team_cannot_view_others_attendance(client, users):
    team = users.create("team")
    other = users.create("team")
    resp = client.get(
        f"/api/v1/attendance?user_id={other.id}", headers=users.auth_headers(team)
    )
    assert resp.status_code == 403
