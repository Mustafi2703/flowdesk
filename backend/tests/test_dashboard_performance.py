"""Dashboard (4.1) and Performance tracker (4.6)."""

from __future__ import annotations

from datetime import date, timedelta


def test_owner_dashboard_has_management_stats(client, users):
    owner = users.create("owner")
    resp = client.get("/api/v1/dashboard", headers=users.auth_headers(owner))
    assert resp.status_code == 200
    stats = resp.json()["stats"]
    assert {"total_tasks", "completed_tasks", "overdue_tasks", "flagged_tasks", "pending_leave_requests"} <= set(stats)


def test_team_dashboard_has_personal_stats_and_clock(client, users):
    team = users.create("team")
    body = client.get("/api/v1/dashboard", headers=users.auth_headers(team)).json()
    assert {"my_tasks", "completed", "due_today", "in_progress"} <= set(body["stats"])
    assert "clock_state" in body


def test_hr_dashboard_stats(client, users):
    hr = users.create("hr")
    stats = client.get("/api/v1/dashboard", headers=users.auth_headers(hr)).json()["stats"]
    assert {"leave_pending", "total_staff"} <= set(stats)


def test_accountant_dashboard_stats(client, users):
    acc = users.create("accountant")
    stats = client.get("/api/v1/dashboard", headers=users.auth_headers(acc)).json()["stats"]
    assert {"billable_tasks", "pending_billing"} <= set(stats)


def test_priority_lane_orders_flagged_and_urgent_first(client, users):
    owner = users.create("owner")
    # A low priority far-future task and a flagged task.
    client.post(
        "/api/v1/tasks",
        headers=users.auth_headers(owner),
        json={
            "title": "Low future",
            "type": "Design",
            "priority": "Low",
            "due_date": (date.today() + timedelta(days=30)).isoformat(),
        },
    )
    flagged = client.post(
        "/api/v1/tasks",
        headers=users.auth_headers(owner),
        json={
            "title": "Urgent flagged",
            "type": "Design",
            "priority": "Critical",
            "due_date": (date.today() - timedelta(days=1)).isoformat(),
        },
    ).json()
    client.post(
        f"/api/v1/tasks/{flagged['id']}/status",
        headers=users.auth_headers(owner),
        json={"status": "Needs Attention"},
    )
    lane = client.get("/api/v1/dashboard", headers=users.auth_headers(owner)).json()["priority_lane"]
    assert lane[0]["title"] == "Urgent flagged"


def test_performance_access_restricted(client, users):
    for role, allowed in [
        ("owner", True),
        ("manager", True),
        ("hr", True),
        ("team", False),
        ("developer", False),
        ("accountant", False),
    ]:
        u = users.create(role)
        resp = client.get("/api/v1/performance", headers=users.auth_headers(u))
        assert (resp.status_code == 200) == allowed, role


def test_performance_tier_excellent_for_full_completion(client, users):
    owner = users.create("owner")
    team = users.create("team")
    # Create and complete a task assigned to team.
    task = client.post(
        "/api/v1/tasks",
        headers=users.auth_headers(owner),
        json={
            "title": "Done deal",
            "type": "Design",
            "priority": "High",
            "assigned_to": [str(team.id)],
            "due_date": (date.today() + timedelta(days=2)).isoformat(),
        },
    ).json()
    client.post(
        f"/api/v1/tasks/{task['id']}/status",
        headers=users.auth_headers(team),
        json={"status": "Completed"},
    )
    overview = client.get(
        f"/api/v1/performance?user_id={team.id}", headers=users.auth_headers(owner)
    ).json()
    card = overview["members"][0]
    assert card["completion_rate"] == 100.0
    assert card["performance_tier"] == "Excellent"
