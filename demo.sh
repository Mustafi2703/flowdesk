#!/usr/bin/env bash
# Scrumfolks TMS — one-command Docker demo.
#
# Brings up the full stack:
#   - postgres (port 5544 on localhost)
#   - backend  (FastAPI, port 8000)
#   - frontend (Next.js,  port 3000)
#
# Re-run safely. Postgres data persists in the named `postgres_data` volume,
# so seeds are not re-applied destructively.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${ROOT}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required. Install Docker Desktop or Docker Engine and retry." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "docker compose v2 plugin is required (try: docker compose version)." >&2
  exit 1
fi

echo "[demo] building images and starting stack"
docker compose up -d --build

echo "[demo] waiting for backend to become healthy"
for i in $(seq 1 60); do
  state="$(docker inspect -f '{{.State.Health.Status}}' scrumfolks-backend 2>/dev/null || echo starting)"
  if [ "${state}" = "healthy" ]; then
    break
  fi
  sleep 2
done

echo "[demo] stack status"
docker compose ps

cat <<'BANNER'

  ╔══════════════════════════════════════════════════════════════════╗
  ║              Scrumfolks TMS — full Docker demo live              ║
  ╠══════════════════════════════════════════════════════════════════╣
  ║  Frontend : http://127.0.0.1:3000                                ║
  ║  Backend  : http://127.0.0.1:8000     (docs at /docs)            ║
  ║  Postgres : 127.0.0.1:5544           (user: tms / pw in env)     ║
  ╠══════════════════════════════════════════════════════════════════╣
  ║  Demo logins — use Quick demo access buttons on /login            ║
  ║    Owner       : owner@scrumfolks.com                            ║
  ║    Manager     : manager@scrumfolks.com                          ║
  ║    Team        : team@scrumfolks.com                             ║
  ║    HR          : hr@scrumfolks.com                               ║
  ║    Accountant  : accountant@scrumfolks.com                       ║
  ║    Developer   : dev@scrumfolks.com                              ║
  ╠══════════════════════════════════════════════════════════════════╣
  ║  Logs   : docker compose logs -f backend frontend                ║
  ║  Stop   : bash demo-stop.sh                                      ║
  ║  Reset  : docker compose down -v   (drops the Postgres volume)   ║
  ╚══════════════════════════════════════════════════════════════════╝

BANNER
