#!/usr/bin/env bash
# Stop the demo containers but keep the Postgres volume so data persists.

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${ROOT}"

docker compose down
echo "[demo] stopped (postgres_data volume preserved — run bash demo.sh to resume)"
echo "[demo] to wipe data too:  docker compose down -v"
