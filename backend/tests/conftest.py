"""Pytest fixtures for the Scrumfolks TMS end-to-end suite.

These tests exercise the real FastAPI app against a real PostgreSQL database
(the models use Postgres-only types: UUID, ARRAY, JSONB), so they validate the
exact behavior the client will get in production.

The suite uses a dedicated throwaway database (default
`scrumfolks_tms_test`) which is created and dropped automatically. Point it
at any Postgres with:

    TEST_DATABASE_URL=postgresql+psycopg://user:pw@host:5432/scrumfolks_tms_test

If no Postgres is reachable, the whole suite is skipped with a clear message
rather than failing spuriously.
"""

from __future__ import annotations

import os
import uuid
from collections.abc import Iterator

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine, make_url
from sqlalchemy.orm import Session, sessionmaker

# Default to the demo Postgres exposed by docker-compose on 127.0.0.1:5544.
DEFAULT_TEST_DB_URL = (
    "postgresql+psycopg://tms:scrumfolks-demo-pw@127.0.0.1:5544/scrumfolks_tms_test"
)
TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL", DEFAULT_TEST_DB_URL)


def _ensure_database_exists(url_str: str) -> bool:
    """Create the target database if it does not exist. Returns reachability."""
    url = make_url(url_str)
    admin_url = url.set(database="postgres")
    try:
        admin = create_engine(admin_url, isolation_level="AUTOCOMMIT")
        with admin.connect() as conn:
            exists = conn.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :n"),
                {"n": url.database},
            ).scalar()
            if not exists:
                conn.execute(text(f'CREATE DATABASE "{url.database}"'))
        admin.dispose()
        return True
    except Exception:  # noqa: BLE001 — any connection error means "skip"
        return False


_REACHABLE = _ensure_database_exists(TEST_DATABASE_URL)

pytestmark = pytest.mark.skipif(
    not _REACHABLE,
    reason=f"No Postgres reachable at {TEST_DATABASE_URL}; set TEST_DATABASE_URL",
)


@pytest.fixture(scope="session")
def engine() -> Iterator[Engine]:
    if not _REACHABLE:
        pytest.skip("Postgres not reachable")
    eng = create_engine(TEST_DATABASE_URL, future=True)
    # Import models so metadata is fully populated, then (re)create schema.
    from app.db.base import Base
    from app import models  # noqa: F401  (registers all mappers)

    Base.metadata.drop_all(eng)
    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)
    eng.dispose()


@pytest.fixture(scope="session")
def _session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


@pytest.fixture()
def db(_session_factory: sessionmaker[Session]) -> Iterator[Session]:
    session = _session_factory()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(autouse=True)
def _clean_tables(engine: Engine) -> Iterator[None]:
    """Truncate all tables before each test for isolation."""
    from app.db.base import Base

    with engine.begin() as conn:
        tables = ", ".join(f'"{t.name}"' for t in reversed(Base.metadata.sorted_tables))
        conn.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
    # Reset in-memory caches/limiter between tests.
    from app.utils.queues import DASHBOARD_CACHE, NOTIFICATION_RINGS

    DASHBOARD_CACHE.invalidate()
    NOTIFICATION_RINGS.clear()
    yield


@pytest.fixture()
def client(_session_factory: sessionmaker[Session]):
    """FastAPI TestClient with get_db overridden to the test session and the
    rate limiter disabled (so repeated logins don't trip 429s)."""
    from fastapi.testclient import TestClient

    from app.api.v1.deps import get_db as dep_get_db
    from app.core.rate_limit import limiter
    from app.db.session import get_db as session_get_db
    from app.main import app

    limiter.enabled = False

    def _override_get_db() -> Iterator[Session]:
        session = _session_factory()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[session_get_db] = _override_get_db
    app.dependency_overrides[dep_get_db] = _override_get_db
    # TrustedHostMiddleware allows localhost in dev/test config. TestClient's
    # default host is "testserver", which production should reject, so use an
    # allowed host here.
    with TestClient(app, base_url="http://localhost") as test_client:
        yield test_client
    app.dependency_overrides.clear()


# ── Helpers ─────────────────────────────────────────────────────────────────
class UserFactory:
    """Creates users directly in the DB and hands back auth headers."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self._counter = 0

    def create(
        self,
        role: str,
        *,
        name: str | None = None,
        email: str | None = None,
        password: str = "Passw0rd!",
        department: str | None = None,
        designation: str | None = None,
        leaves_total: int = 21,
        is_active: bool = True,
        manager_id=None,
    ):
        from app.core.security import hash_password
        from app.models.profile import Profile

        self._counter += 1
        suffix = uuid.uuid4().hex[:8]
        profile = Profile(
            name=name or f"{role.title()} {self._counter}",
            email=email or f"{role}-{suffix}@scrumfolks.io",
            password_hash=hash_password(password),
            role=role,
            department=department,
            designation=designation,
            avatar=role[:2].upper(),
            leaves_total=leaves_total,
            is_active=is_active,
            manager_id=manager_id,
        )
        self.db.add(profile)
        self.db.commit()
        self.db.refresh(profile)
        return profile

    @staticmethod
    def auth_headers(profile) -> dict[str, str]:
        from app.core.security import create_access_token

        token = create_access_token(
            str(profile.id),
            role=profile.role,
            name=profile.name,
            email=profile.email,
            avatar=profile.avatar,
        )
        return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def users(db: Session) -> UserFactory:
    return UserFactory(db)
