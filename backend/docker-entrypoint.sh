#!/usr/bin/env bash
# Backend container entrypoint.
#
# Sequence:
#   1. Wait for Postgres to accept connections (driver-level probe).
#   2. Run Alembic migrations (idempotent — no-op after the first run).
#   3. Seed demo accounts (or bootstrap owner only when SEED_DEMO=false).
#   4. Exec the app server.
#
# Server selection:
#   - APP_ENV=production  -> gunicorn + uvicorn workers (preforked, robust)
#   - otherwise           -> uvicorn directly (faster reloads, simpler logs)
#
# Concurrency knobs (env):
#   GUNICORN_WORKERS  - number of preforked workers (default = 2*CPU + 1, max 4)
#   UVICORN_WORKERS   - number of uvicorn workers when not in production
#   WORKER_TIMEOUT    - seconds before a worker is force-killed (default 60)

set -euo pipefail

echo "[backend] waiting for PostgreSQL"
python - <<'PY'
import os
import time

from sqlalchemy import create_engine, text

url = os.environ.get("DATABASE_URL")
if not url:
    raise SystemExit("DATABASE_URL is required")

# Managed hosts hand out plain postgres:// URLs; force the psycopg v3 driver
# so this probe uses the same dialect the app does.
if url.startswith("postgresql://"):
    url = "postgresql+psycopg://" + url[len("postgresql://"):]
elif url.startswith("postgres://"):
    url = "postgresql+psycopg://" + url[len("postgres://"):]

for attempt in range(1, 61):
    try:
        engine = create_engine(url, pool_pre_ping=True)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print(f"[backend] Postgres reachable on attempt {attempt}")
        break
    except Exception as exc:  # noqa: BLE001
        print(f"[backend] attempt {attempt}: {exc}")
        time.sleep(1)
else:
    raise SystemExit("[backend] Postgres never came up")
PY

echo "[backend] running migrations"
alembic upgrade head

if [ "${RESET_WORKSPACE:-false}" = "true" ]; then
    echo "[backend] RESET_WORKSPACE=true — clearing all application data"
    python -m app.scripts.reset_workspace
fi

if [ "${SEED_DEMO:-false}" = "true" ]; then
    if [ "${SEED_FULL_DEMO:-false}" = "true" ]; then
        echo "[backend] seeding full demo data"
        python -m app.scripts.seed
    else
        echo "[backend] seeding demo users only (no sample data)"
        python -c "from app.scripts.seed import seed_users_only; seed_users_only()"
    fi
else
    echo "[backend] production mode - bootstrapping owner account only"
    python -m app.scripts.bootstrap_admin
fi

APP_ENV="${APP_ENV:-production}"
WORKER_TIMEOUT="${WORKER_TIMEOUT:-60}"
# Railway (and most PaaS) inject the port to listen on via $PORT. Bind to the
# IPv6 wildcard so both the platform's private network (IPv6-only) and local
# IPv4 (via v4-mapped addresses on Linux) can reach us. Falls back to 8000 for
# docker-compose where the port is fixed.
LISTEN_PORT="${PORT:-8000}"

if [ "${APP_ENV}" = "production" ]; then
    # Gunicorn preforks workers, each running a single uvicorn loop. This is
    # the recommended production topology for FastAPI on Linux: stable signal
    # handling, predictable memory usage, graceful restarts.
    CPU="$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 2)"
    DEFAULT="$(( CPU * 2 + 1 ))"
    [ "${DEFAULT}" -gt 4 ] && DEFAULT=4
    WORKERS="${GUNICORN_WORKERS:-${DEFAULT}}"
    echo "[backend] starting gunicorn (workers=${WORKERS}, timeout=${WORKER_TIMEOUT}s, port=${LISTEN_PORT})"
    exec gunicorn app.main:app \
        --bind "[::]:${LISTEN_PORT}" \
        --workers "${WORKERS}" \
        --worker-class uvicorn.workers.UvicornWorker \
        --timeout "${WORKER_TIMEOUT}" \
        --graceful-timeout 30 \
        --keep-alive 5 \
        --max-requests 1000 \
        --max-requests-jitter 100 \
        --forwarded-allow-ips '*' \
        --access-logfile - \
        --error-logfile -
else
    WORKERS="${UVICORN_WORKERS:-2}"
    echo "[backend] starting uvicorn (workers=${WORKERS}, port=${LISTEN_PORT})"
    exec uvicorn app.main:app \
        --host "::" \
        --port "${LISTEN_PORT}" \
        --workers "${WORKERS}" \
        --proxy-headers \
        --forwarded-allow-ips "*" \
        --log-level info
fi
