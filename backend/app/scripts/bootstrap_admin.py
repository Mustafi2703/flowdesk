"""Bootstrap the first Owner account for a clean production database.

Unlike `app.scripts.seed` (which inserts demo users/brands/tasks for a
sales demo), this script creates exactly ONE Owner account and nothing
else. From there, the Owner logs in and onboards every other user through
the Team module — which is how a real production rollout should work.

Run automatically by docker-entrypoint.sh when SEED_DEMO is not "true",
or manually:

    python -m app.scripts.bootstrap_admin

Configuration (env / settings):

    BOOTSTRAP_OWNER_NAME      default "Rushabh Shah"
    BOOTSTRAP_OWNER_EMAIL     default "owner@scrumfolks.com"
    BOOTSTRAP_OWNER_PASSWORD  required to create the account

The script is idempotent:

* If any owner already exists, it does nothing.
* If the configured email exists, it does nothing.
* If no password is configured, it logs a warning and exits cleanly so a
  boot never fails just because the operator has not set a password yet.
"""

from __future__ import annotations

import sys

from sqlalchemy import select

from app.core.config import settings
from app.core.roles import Role
from app.core.security import hash_password
from app.db.session import db_session
from app.models.profile import Profile


def bootstrap_admin() -> bool:
    """Create the first owner if needed. Returns True if a user was created."""
    password = settings.bootstrap_owner_password
    email = (settings.bootstrap_owner_email or "").lower().strip()

    with db_session() as db:
        existing_owner = db.scalar(select(Profile).where(Profile.role == Role.OWNER.value))
        if existing_owner:
            print(f"[bootstrap] owner already exists ({existing_owner.email}); nothing to do")  # noqa: T201
            return False

        if db.scalar(select(Profile).where(Profile.email == email)):
            print(f"[bootstrap] account {email} already exists; nothing to do")  # noqa: T201
            return False

        if not password:
            print(  # noqa: T201
                "[bootstrap] BOOTSTRAP_OWNER_PASSWORD is not set — skipping owner "
                "creation. Set it and restart to create the first admin."
            )
            return False

        if len(password) < 8:
            print("[bootstrap] BOOTSTRAP_OWNER_PASSWORD must be at least 8 characters")  # noqa: T201
            raise SystemExit(1)

        owner = Profile(
            name=settings.bootstrap_owner_name.strip(),
            email=email,
            password_hash=hash_password(password),
            role=Role.OWNER.value,
            department="Leadership",
            designation="Director",
            avatar=(settings.bootstrap_owner_name[:2] or "OW").upper(),
        )
        db.add(owner)
        print(f"[bootstrap] created owner account: {email}")  # noqa: T201
        return True


if __name__ == "__main__":
    created = bootstrap_admin()
    sys.exit(0 if created or True else 1)
