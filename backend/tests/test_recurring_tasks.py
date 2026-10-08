"""Recurring task due-date advance + spawn-on-complete."""

from __future__ import annotations

from datetime import date, timedelta

from app.services.recurring_tasks import advance_due_date


def test_advance_daily():
    assert advance_due_date(date(2026, 10, 8), "daily") == date(2026, 10, 9)


def test_advance_weekly():
    assert advance_due_date(date(2026, 10, 8), "weekly") == date(2026, 10, 15)


def test_advance_monthly_end_of_month():
    assert advance_due_date(date(2026, 1, 31), "monthly") == date(2026, 2, 28)


def test_advance_yearly_leap():
    assert advance_due_date(date(2024, 2, 29), "yearly") == date(2025, 2, 28)


def test_spawn_on_complete(client, users):
    owner = users.create("owner")
    team = users.create("team")
    due = date.today()
    created = client.post(
        "/api/v1/tasks",
        headers=users.auth_headers(owner),
        json={
            "title": "Monthly report",
            "assigned_to": [str(team.id)],
            "due_date": due.isoformat(),
            "priority": "Medium",
            "status": "Not Started",
            "requires_review": False,
            "recurring_config": {
                "enabled": True,
                "frequency": "monthly",
                "next_due": due.isoformat(),
            },
        },
    )
    assert created.status_code in (200, 201), created.text
    task_id = created.json()["id"]

    done = client.patch(
        f"/api/v1/tasks/{task_id}",
        headers=users.auth_headers(owner),
        json={"status": "Completed"},
    )
    assert done.status_code == 200, done.text
    body = done.json()
    assert body["status"] == "Completed"
    assert body.get("spawned_recurring_task_id")
    assert body.get("recurring_config", {}).get("enabled") is False

    spawned_id = body["spawned_recurring_task_id"]
    nxt = client.get(f"/api/v1/tasks/{spawned_id}", headers=users.auth_headers(owner))
    assert nxt.status_code == 200, nxt.text
    child = nxt.json()
    assert child["status"] == "Not Started"
    assert child["recurring_config"]["enabled"] is True
    assert child["recurring_config"]["frequency"] == "monthly"
    expected = advance_due_date(due, "monthly").isoformat()
    assert child["due_date"] == expected
    assert child["title"] == "Monthly report"

    # Completing again must not spawn a second child from the disabled parent.
    again = client.patch(
        f"/api/v1/tasks/{task_id}",
        headers=users.auth_headers(owner),
        json={"status": "Completed"},
    )
    assert again.status_code == 200
    assert again.json().get("spawned_recurring_task_id") in (None, "")


def test_spawn_on_review_approve(client, users):
    owner = users.create("owner")
    team = users.create("team")
    due = date.today()
    created = client.post(
        "/api/v1/tasks",
        headers=users.auth_headers(owner),
        json={
            "title": "Weekly QA",
            "assigned_to": [str(team.id)],
            "due_date": due.isoformat(),
            "priority": "High",
            "status": "Under Review",
            "requires_review": True,
            "recurring_config": {
                "enabled": True,
                "frequency": "weekly",
                "next_due": due.isoformat(),
            },
        },
    )
    assert created.status_code in (200, 201), created.text
    task_id = created.json()["id"]

    approved = client.patch(
        f"/api/v1/tasks/{task_id}/review",
        headers=users.auth_headers(owner),
        json={"decision": "approved", "notes": "Looks good"},
    )
    assert approved.status_code == 200, approved.text
    body = approved.json()
    assert body["status"] == "Completed"
    assert body.get("spawned_recurring_task_id")

    spawned_id = body["spawned_recurring_task_id"]
    nxt = client.get(f"/api/v1/tasks/{spawned_id}", headers=users.auth_headers(owner))
    assert nxt.status_code == 200, nxt.text
    child = nxt.json()
    assert child["status"] == "Not Started"
    assert child["recurring_config"]["enabled"] is True
    assert child["recurring_config"]["frequency"] == "weekly"
    assert child["due_date"] == advance_due_date(due, "weekly").isoformat()
