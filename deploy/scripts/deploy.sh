#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/scrumfolks-tms}"
DOMAIN="${DOMAIN:-tasks.scrumfolks.com}"

cd "${APP_DIR}"

if [[ ! -f backend/.env ]]; then
  echo "Missing backend/.env. Copy backend/.env.example and fill production secrets first."
  exit 1
fi

set -a
source backend/.env
set +a

required=(APP_BASE_URL JWT_SECRET CRON_SECRET POSTGRES_PASSWORD DATABASE_URL ALLOWED_HOSTS ALLOWED_ORIGINS)
for key in "${required[@]}"; do
  if [[ -z "${!key:-}" ]] || [[ "${!key}" == change-me* ]]; then
    echo "backend/.env is missing a production value for ${key}"
    exit 1
  fi
done

if [[ "${COOKIE_SECURE:-true}" != "true" ]]; then
  echo "COOKIE_SECURE must be true in production."
  exit 1
fi

if command -v git >/dev/null 2>&1 && [[ -d .git ]]; then
  git pull --ff-only
fi

cd "${APP_DIR}/deploy"
mkdir -p backups

docker compose --env-file ../backend/.env -f docker-compose.yml pull --ignore-buildable
docker compose --env-file ../backend/.env -f docker-compose.yml up -d --build --remove-orphans
docker compose --env-file ../backend/.env -f docker-compose.yml ps

echo "Waiting for backend health..."
for _ in {1..30}; do
  if curl -fsS http://127.0.0.1:8000/health >/dev/null; then
    echo "Backend healthy."
    break
  fi
  sleep 2
done

echo "Waiting for frontend..."
for _ in {1..30}; do
  if curl -fsS http://127.0.0.1:3000 >/dev/null; then
    echo "Frontend responding."
    break
  fi
  sleep 2
done

if [[ -f "nginx/${DOMAIN}.conf" ]]; then
  sudo cp "nginx/${DOMAIN}.conf" "/etc/nginx/sites-available/${DOMAIN}"
  sudo ln -sfn "/etc/nginx/sites-available/${DOMAIN}" "/etc/nginx/sites-enabled/${DOMAIN}"
  sudo nginx -t
  sudo systemctl reload nginx
fi

echo "Deploy complete. Verify: curl -fsS https://${DOMAIN}/health"
