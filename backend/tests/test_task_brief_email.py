"""Task brief email formatting."""

from __future__ import annotations

import uuid
from datetime import date

from app.models.brand import Brand
from app.models.profile import Profile
from app.models.task import Task
from app.services.task_brief_email import build_task_brief_email


def test_build_task_brief_email_includes_core_fields():
    task = Task(
        id=uuid.uuid4(),
        title="Design 10 Static Posts",
        description="Create posts for May calendar.",
        type="Design",
        priority="High",
        status="Not Started",
        start_date=date(2026, 8, 1),
        due_date=date(2026, 8, 10),
        requires_review=True,
        sub_tasks=[{"title": "Wireframes", "status": "In Progress", "due_date": "2026-08-05"}],
        checklist=[{"text": "Get brand assets", "done": True}],
        external_links=[{"label": "Drive folder", "url": "https://drive.google.com/example"}],
    )
    assignee = Profile(
        id=uuid.uuid4(),
        name="Demo Team",
        email="team@scrumfolks.com",
        password_hash="x",
        role="team",
    )
    assigner = Profile(
        id=uuid.uuid4(),
        name="Demo Manager",
        email="manager@scrumfolks.com",
        password_hash="x",
        role="manager",
    )
    brand = Brand(id=uuid.uuid4(), name="Dinamoo Lighting", logo="DL")

    subject, html_body, text_body = build_task_brief_email(
        task=task,
        assignee=assignee,
        assigner=assigner,
        brand=brand,
    )

    assert "Design 10 Static Posts" in subject
    assert "Dinamoo Lighting" in subject
    assert "Design 10 Static Posts" in html_body
    assert "Create posts for May calendar." in html_body
    assert "Wireframes" in html_body
    assert "Get brand assets" in html_body
    assert "drive.google.com" in html_body
    assert "Google Drive" in html_body
    assert "Open Updates chat" in html_body
    assert "Demo Team" in text_body
    assert "Demo Manager" in text_body
    assert "https://drive.google.com/example" in text_body
