"""Tasks module (requirements section 4.2 & 4.3) + RBAC."""

from __future__ import annotations

from datetime import date, timedelta


def _create_task(client, headers, **overrides):
    payload = {
        "title": "Design 10 Static Posts",
        "type": "Design",
        "priority": "High",
        "due_date": (date.today() + timedelta(days=3)).isoformat(),
    }
    payload.update(overrides)
    return client.post("/api/v1/tasks", headers=headers, json=payload)


def test_owner_can_create_task_defaults_titlecase_status(client, users):
    owner = users.create("owner")
    resp = _create_task(client, users.auth_headers(owner))
    assert resp.status_code == 201
    body = resp.json()
    # The critical sync fix: brand-new tasks must be "Not Started", not lowercase.
    assert body["status"] == "Not Started"
    assert body["created_by"] == str(owner.id)


def test_manager_can_create_task(client, users):
    manager = users.create("manager")
    assert _create_task(client, users.auth_headers(manager)).status_code == 201


def test_team_cannot_create_task(client, users):
    team = users.create("team")
    assert _create_task(client, users.auth_headers(team)).status_code == 403


def test_team_sees_only_assigned_tasks(client, users):
    owner = users.create("owner")
    team = users.create("team")
    other = users.create("team")
    # one task assigned to team, one to other
    _create_task(client, users.auth_headers(owner), title="For team", assigned_to=[str(team.id)])
    _create_task(client, users.auth_headers(owner), title="For other", assigned_to=[str(other.id)])

    team_tasks = client.get("/api/v1/tasks", headers=users.auth_headers(team)).json()
    titles = {t["title"] for t in team_tasks}
    assert titles == {"For team"}
    # owner sees all
    owner_tasks = client.get("/api/v1/tasks", headers=users.auth_headers(owner)).json()
    assert len({t["title"] for t in owner_tasks}) == 2


def test_team_can_update_status_only(client, users):
    owner = users.create("owner")
    team = users.create("team")
    task = _create_task(
        client, users.auth_headers(owner), assigned_to=[str(team.id)]
    ).json()
    # status update allowed
    ok = client.patch(
        f"/api/v1/tasks/{task['id']}",
        headers=users.auth_headers(team),
        json={"status": "In Progress"},
    )
    assert ok.status_code == 200
    assert ok.json()["status"] == "In Progress"
    # editing metadata (title) forbidden for team
    bad = client.patch(
        f"/api/v1/tasks/{task['id']}",
        headers=users.auth_headers(team),
        json={"title": "Hacked"},
    )
    assert bad.status_code == 403


def test_hr_cannot_update_unassigned_task_status(client, users):
    owner = users.create("owner")
    team = users.create("team")
    hr = users.create("hr")
    task = _create_task(
        client, users.auth_headers(owner), assigned_to=[str(team.id)]
    ).json()
    resp = client.patch(
        f"/api/v1/tasks/{task['id']}",
        headers=users.auth_headers(hr),
        json={"status": "In Progress"},
    )
    assert resp.status_code == 403


def test_owner_and_manager_can_delete_task(client, users):
    owner = users.create("owner")
    manager = users.create("manager")
    team = users.create("team")
    task = _create_task(client, users.auth_headers(owner)).json()
    assert client.delete(
        f"/api/v1/tasks/{task['id']}", headers=users.auth_headers(team)
    ).status_code == 403
    assert client.delete(
        f"/api/v1/tasks/{task['id']}", headers=users.auth_headers(manager)
    ).status_code == 200
    task2 = _create_task(client, users.auth_headers(owner)).json()
    assert client.delete(
        f"/api/v1/tasks/{task2['id']}", headers=users.auth_headers(owner)
    ).status_code == 200


def test_status_endpoint_changes_status(client, users):
    owner = users.create("owner")
    team = users.create("team")
    task = _create_task(client, users.auth_headers(owner), assigned_to=[str(team.id)]).json()
    resp = client.post(
        f"/api/v1/tasks/{task['id']}/status",
        headers=users.auth_headers(team),
        json={"status": "Struggling"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "Struggling"


def test_flagging_notifies_managers(client, users):
    owner = users.create("owner")
    manager = users.create("manager")
    team = users.create("team")
    task = _create_task(
        client,
        users.auth_headers(owner),
        assigned_to=[str(team.id)],
        assigned_managers=[str(manager.id)],
    ).json()
    client.post(
        f"/api/v1/tasks/{task['id']}/status",
        headers=users.auth_headers(team),
        json={"status": "Needs Attention"},
    )
    notes = client.get("/api/v1/notifications", headers=users.auth_headers(manager)).json()
    assert any("flagged" in (n["message"] or "").lower() for n in notes)


def test_task_assignment_creates_notification(client, users):
    owner = users.create("owner")
    team = users.create("team")
    _create_task(client, users.auth_headers(owner), assigned_to=[str(team.id)])
    notes = client.get("/api/v1/notifications", headers=users.auth_headers(team)).json()
    assert any("assigned" in (n["message"] or "").lower() for n in notes)


def test_task_chat_scoped_to_participants(client, users):
    owner = users.create("owner")
    team = users.create("team")
    outsider = users.create("team")
    task = _create_task(client, users.auth_headers(owner), assigned_to=[str(team.id)]).json()
    # participant can post
    sent = client.post(
        f"/api/v1/tasks/{task['id']}/chats",
        headers=users.auth_headers(team),
        json={"message": "On it!"},
    )
    assert sent.status_code == 201
    # outsider cannot even see the task
    assert client.get(
        f"/api/v1/tasks/{task['id']}/chats", headers=users.auth_headers(outsider)
    ).status_code == 404


def test_dev_board_shows_dev_and_project_tasks(client, users):
    owner = users.create("owner")
    dev = users.create("developer")
    # development task assigned to dev
    _create_task(
        client,
        users.auth_headers(owner),
        title="Build API",
        type="Development",
        assigned_to=[str(dev.id)],
    )
    # non-dev standard task
    _create_task(client, users.auth_headers(owner), title="Design poster", type="Design")
    board = client.get("/api/v1/dev-board", headers=users.auth_headers(dev)).json()
    titles = {t["title"] for t in board}
    assert "Build API" in titles
    assert "Design poster" not in titles
