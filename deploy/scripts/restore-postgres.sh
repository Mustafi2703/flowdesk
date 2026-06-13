#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/scrumfolks-tms}"
BACKUP_FILE="${1:-}"

if [[ -z "${BACKUP_FILE}" || ! -f "${BACKUP_FILE}" ]]; then
  echo "Usage: APP_DIR=/opt/scrumfolks-tms bash deploy/scripts/restore-postgres.sh /path/to/backup.sql.gz"
  exit 1
fi

read -r -p "This will replace the scrumfolks_tms database. Type RESTORE to continue: " confirm
if [[ "${confirm}" != "RESTORE" ]]; then
  echo "Restore cancelled."
  exit 1
fi

cd "${APP_DIR}/deploy"

docker compose --env-file ../backend/.env -f docker-compose.yml stop backend frontend
gunzip -c "${BACKUP_FILE}" | docker compose --env-file ../backend/.env -f docker-compose.yml exec -T postgres \
  psql -U tms -d scrumfolks_tms
docker compose --env-file ../backend/.env -f docker-compose.yml up -d backend frontend

echo "Restore complete."
