"""Leave management (requirements section 4.8)."""

from __future__ import annotations

from datetime import date, timedelta


def _submit(client, users, applicant, days=2, leave_type="Casual"):
    start = date.today() + timedelta(days=5)
    end = start + timedelta(days=days - 1)
    return client.post(
        "/api/v1/leaves",
        headers=users.auth_headers(applicant),
        json={
            "leave_type": leave_type,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "reason": "Family event",
        },
    )


def test_submit_calculates_days_inclusive(client, users):
    team = users.create("team")
    resp = _submit(client, users, team, days=3)
    assert resp.status_code == 201
    assert resp.json()["days"] == 3
    assert resp.json()["status"] == "Pending"


def test_balance_starts_at_21(client, users):
    team = users.create("team")
    bal = client.get("/api/v1/leaves/balance", headers=users.auth_headers(team)).json()
    assert bal["total"] == 21
    assert bal["taken"] == 0
    assert bal["remaining"] == 21


def test_hr_approval_increments_taken(client, users):
    hr = users.create("hr")
    team = users.create("team")
    leave = _submit(client, users, team, days=2).json()
    resp = client.patch(
        f"/api/v1/leaves/{leave['id']}",
        headers=users.auth_headers(hr),
        json={"status": "Approved"},
    )
    assert resp.status_code == 200
    bal = client.get("/api/v1/leaves/balance", headers=users.auth_headers(team)).json()
    assert bal["taken"] == 2
    assert bal["remaining"] == 19


def test_rejection_does_not_change_balance(client, users):
    hr = users.create("hr")
    team = users.create("team")
    leave = _submit(client, users, team, days=2).json()
    client.patch(
        f"/api/v1/leaves/{leave['id']}",
        headers=users.auth_headers(hr),
        json={"status": "Rejected", "rejection_reason": "Peak season"},
    )
    bal = client.get("/api/v1/leaves/balance", headers=users.auth_headers(team)).json()
    assert bal["taken"] == 0


def test_manager_can_submit_leave(client, users):
    manager = users.create("manager")
    resp = _submit(client, users, manager, days=1, leave_type="Casual")
    assert resp.status_code == 201
    assert resp.json()["status"] == "Pending"


def test_team_cannot_approve(client, users):
    team = users.create("team")
    other = users.create("team")
    leave = _submit(client, users, other).json()
    resp = client.patch(
        f"/api/v1/leaves/{leave['id']}",
        headers=users.auth_headers(team),
        json={"status": "Approved"},
    )
    assert resp.status_code == 403


def test_already_decided_cannot_reaction(client, users):
    hr = users.create("hr")
    team = users.create("team")
    leave = _submit(client, users, team).json()
    client.patch(
        f"/api/v1/leaves/{leave['id']}",
        headers=users.auth_headers(hr),
        json={"status": "Approved"},
    )
    again = client.patch(
        f"/api/v1/leaves/{leave['id']}",
        headers=users.auth_headers(hr),
        json={"status": "Rejected"},
    )
    assert again.status_code == 400


def test_team_sees_only_own_leaves_admin_sees_all(client, users):
    hr = users.create("hr")
    a = users.create("team")
    b = users.create("team")
    _submit(client, users, a)
    _submit(client, users, b)
    own = client.get("/api/v1/leaves", headers=users.auth_headers(a)).json()
    assert {leave["user_id"] for leave in own} == {str(a.id)}
    all_leaves = client.get("/api/v1/leaves", headers=users.auth_headers(hr)).json()
    assert {leave["user_id"] for leave in all_leaves} == {str(a.id), str(b.id)}


def test_submission_notifies_hr_and_owner(client, users):
    owner = users.create("owner")
    hr = users.create("hr")
    team = users.create("team")
    _submit(client, users, team)
    for admin in (owner, hr):
        notes = client.get("/api/v1/notifications", headers=users.auth_headers(admin)).json()
        assert any("leave" in (n["message"] or "").lower() for n in notes)
