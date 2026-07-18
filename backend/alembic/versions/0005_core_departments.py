"""Normalize departments to Owner/Manager/Team/Accounts/HR and retire Developer.

Revision ID: 0005_core_departments
Revises: 0004_brand_journey
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0005_core_departments"
down_revision = "0004_brand_journey"
branch_labels = None
depends_on = None

# Old department label → canonical label
_RENAME = {
    "Leadership": "Owner",
    "Operations": "Manager",
    "Design": "Team",
    "Finance": "Accounts",
    "Technology": "Team",
    "Dev": "Team",
    "Developer": "Team",
    "Development": "Team",
}

_CANONICAL = [
    ("Owner", "Executive ownership and strategy"),
    ("Manager", "Delivery and people management"),
    ("Team", "Execution and production"),
    ("Accounts", "Billing and finance"),
    ("HR", "People operations and leave"),
]


def upgrade() -> None:
    conn = op.get_bind()

    # 1) Convert developer role accounts → team
    conn.execute(sa.text("UPDATE profiles SET role = 'team' WHERE role = 'developer'"))
    conn.execute(
        sa.text(
            "UPDATE profiles SET designation = 'Team Member' "
            "WHERE role = 'team' AND (designation ILIKE '%developer%' OR designation IS NULL OR designation = '')"
        )
    )

    # 2) Rename known old department labels on profiles
    for old, new in _RENAME.items():
        conn.execute(
            sa.text("UPDATE profiles SET department = :new WHERE lower(department) = lower(:old)"),
            {"old": old, "new": new},
        )

    # 3) Ensure canonical department rows exist
    existing = {
        row[0].lower(): row[0]
        for row in conn.execute(sa.text("SELECT name FROM departments")).fetchall()
    }
    for name, description in _CANONICAL:
        if name.lower() not in existing:
            conn.execute(
                sa.text(
                    "INSERT INTO departments (id, name, description, created_at, updated_at) "
                    "VALUES (gen_random_uuid(), :name, :description, now(), now())"
                ),
                {"name": name, "description": description},
            )
        else:
            # Rename case/spelling to canonical if needed
            old_name = existing[name.lower()]
            if old_name != name:
                conn.execute(
                    sa.text("UPDATE departments SET name = :new WHERE name = :old"),
                    {"old": old_name, "new": name},
                )
            conn.execute(
                sa.text("UPDATE departments SET description = :d WHERE name = :n"),
                {"d": description, "n": name},
            )

    # 4) Remap / drop non-canonical departments
    allowed = {n.lower() for n, _ in _CANONICAL}
    rows = conn.execute(sa.text("SELECT id, name FROM departments")).fetchall()
    team_id = conn.execute(
        sa.text("SELECT id FROM departments WHERE lower(name) = 'team' LIMIT 1")
    ).scalar()
    for dept_id, name in rows:
        if name.lower() in allowed:
            continue
        # Point any leftover profile labels, then delete the org unit
        target = _RENAME.get(name, "Team")
        conn.execute(
            sa.text("UPDATE profiles SET department = :t WHERE lower(department) = lower(:n)"),
            {"t": target, "n": name},
        )
        conn.execute(sa.text("DELETE FROM departments WHERE id = :id"), {"id": dept_id})

    # 5) Normalize remaining profile departments outside the allow-list
    conn.execute(
        sa.text(
            "UPDATE profiles SET department = 'Team' "
            "WHERE department IS NOT NULL AND lower(department) NOT IN "
            "('owner','manager','team','accounts','hr')"
        )
    )


def downgrade() -> None:
    # Non-destructive reverse is not meaningful; leave departments as-is.
    pass
