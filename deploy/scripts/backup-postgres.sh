#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/scrumfolks-tms}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/scrumfolks-tms}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

cd "${APP_DIR}/deploy"
mkdir -p "${BACKUP_DIR}"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="${BACKUP_DIR}/scrumfolks_tms_${timestamp}.sql.gz"

docker compose --env-file ../backend/.env -f docker-compose.yml exec -T postgres \
  pg_dump -U tms -d scrumfolks_tms --clean --if-exists \
  | gzip -9 > "${target}"

chmod 0600 "${target}"
find "${BACKUP_DIR}" -name 'scrumfolks_tms_*.sql.gz' -mtime "+${RETENTION_DAYS}" -delete

echo "Backup written: ${target}"
