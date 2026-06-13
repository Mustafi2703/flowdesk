# Scrumfolks TMS Droplet Deployment

Production target: `https://tasks.scrumfolks.com`

This runbook is for a single production droplet that comfortably handles 50-60 normal office users: Next.js frontend, FastAPI backend, Postgres, Redis, Nginx, TLS, UFW, fail2ban, systemd, and nightly database backups.

## 1. Capacity Target

Recommended droplet:

- Ubuntu 24.04 LTS
- 2 vCPU minimum, 4 vCPU preferred if files/AI usage is heavy
- 4 GB RAM minimum
- 60 GB SSD disk minimum
- Swap enabled by the cloud image or manually configured

Production defaults:

- `GUNICORN_WORKERS=3`
- `DATABASE_POOL_SIZE=10`
- `DATABASE_MAX_OVERFLOW=10`
- Postgres, Redis, FastAPI, and Next.js ports bound to `127.0.0.1`
- Public traffic allowed only on `80` and `443`

For 50-60 users this gives enough concurrent request handling without letting app workers exhaust Postgres connections.

## 2. DNS

In Cloudflare or your DNS provider:

- Add `A` record: `tasks` -> droplet public IPv4
- If using Cloudflare proxy, start with proxy OFF until Certbot succeeds
- After Certbot works, Cloudflare SSL mode should be `Full (strict)`

## 3. Install Server Packages

```bash
ssh root@<droplet-ip>
git clone <private-repo-url> /opt/scrumfolks-tms
cd /opt/scrumfolks-tms
sudo bash deploy/scripts/install-droplet.sh
sudo bash deploy/scripts/setup-firewall.sh
```

## 4. Configure Secrets

```bash
cd /opt/scrumfolks-tms
cp backend/.env.example backend/.env
nano backend/.env
```

Must change:

- `APP_BASE_URL=https://tasks.scrumfolks.com`
- `ALLOWED_HOSTS=tasks.scrumfolks.com,localhost,127.0.0.1,backend,frontend`
- `ALLOWED_ORIGINS=https://tasks.scrumfolks.com`
- `JWT_SECRET` generated with `python3 -c 'import secrets; print(secrets.token_urlsafe(48))'`
- `CRON_SECRET` generated with `python3 -c 'import secrets; print(secrets.token_urlsafe(32))'`
- `POSTGRES_PASSWORD`
- `DATABASE_URL=postgresql+psycopg://tms:<POSTGRES_PASSWORD>@postgres:5432/scrumfolks_tms`
- `COOKIE_NAME=sf_sess`
- `COOKIE_SECURE=true`
- `COOKIE_DOMAIN=tasks.scrumfolks.com`
- `SEED_DEMO=false` for a real production launch

Optional:

- `RESEND_API_KEY` for email
- `ANTHROPIC_API_KEY` for AI task descriptions

## 5. First Deploy

```bash
cd /opt/scrumfolks-tms
bash deploy/scripts/deploy.sh
```

This builds and starts:

- `frontend` on `127.0.0.1:3000`
- `backend` on `127.0.0.1:8000`
- `postgres` on `127.0.0.1:5544`
- `redis` on `127.0.0.1:6379`

Check:

```bash
docker compose --env-file backend/.env -f deploy/docker-compose.yml ps
curl -fsS http://127.0.0.1:8000/health
curl -fsS http://127.0.0.1:3000
```

## 6. TLS And Nginx

The production Nginx config expects a real certificate path. On a fresh droplet, issue the certificate first:

```bash
sudo certbot certonly --nginx -d tasks.scrumfolks.com
sudo cp deploy/nginx/tasks.scrumfolks.com.conf /etc/nginx/sites-available/tasks.scrumfolks.com
sudo ln -sfn /etc/nginx/sites-available/tasks.scrumfolks.com /etc/nginx/sites-enabled/tasks.scrumfolks.com
sudo nginx -t
sudo systemctl reload nginx
sudo certbot renew --dry-run
```

Verify:

```bash
curl -fsS https://tasks.scrumfolks.com/health
```

## 7. Systemd And Backups

```bash
sudo cp deploy/systemd/scrumfolks-tms.service /etc/systemd/system/
sudo cp deploy/systemd/scrumfolks-tms-backup.service /etc/systemd/system/
sudo cp deploy/systemd/scrumfolks-tms-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable scrumfolks-tms
sudo systemctl enable --now scrumfolks-tms-backup.timer
```

Manual backup:

```bash
sudo APP_DIR=/opt/scrumfolks-tms BACKUP_DIR=/var/backups/scrumfolks-tms bash deploy/scripts/backup-postgres.sh
```

Restore:

```bash
sudo APP_DIR=/opt/scrumfolks-tms bash deploy/scripts/restore-postgres.sh /var/backups/scrumfolks-tms/<backup>.sql.gz
```

Keep an off-server copy of `/var/backups/scrumfolks-tms` using provider snapshots, `rsync`, S3, or Spaces.

## 8. User Management Handover

Owner:

- Can onboard any role
- Can edit users
- Can deactivate users
- Can reset passwords through HR/admin flow

Manager:

- Can onboard `team` and `developer` users
- Can set department/designation/responsibility during onboarding
- Gets a one-time temporary password to share securely
- Cannot create privileged users such as owner, manager, HR, or accountant

HR:

- Can view the team module
- Can reset non-privileged passwords

The Team screen now includes Add User, temporary-password display, password reset, and deactivate controls based on the logged-in role.

## 9. Launch Verification

Before handover:

- Login works through `https://tasks.scrumfolks.com`
- Owner creates a manager, manager creates a team member
- Manager cannot create owner/HR/accountant users
- New user logs in with the temporary password
- New user changes password via profile/auth flow
- Owner creates and assigns a task
- Team member only sees assigned work and assigned brands
- HR approves/rejects leave and balance updates
- Accountant sees billing fields; team members do not
- Daily cron endpoint works only with `X-Cron-Secret`
- `docker compose ... ps` shows all services healthy
- `systemctl list-timers | grep scrumfolks` shows nightly backup timer
- Off-server snapshot/backup is configured

## 10. Operations

Deploy updates:

```bash
cd /opt/scrumfolks-tms
bash deploy/scripts/deploy.sh
```

Logs:

```bash
docker compose --env-file backend/.env -f deploy/docker-compose.yml logs -f backend
docker compose --env-file backend/.env -f deploy/docker-compose.yml logs -f frontend
sudo journalctl -u nginx -f
```

Scale later:

- Move Postgres to managed database first
- Increase droplet to 4 vCPU / 8 GB RAM
- Set `GUNICORN_WORKERS=5`
- Reduce per-worker pool if Postgres connection limits are low

## 11. End-to-End Test Suite

The full suite (`backend/tests/`) runs the real FastAPI app against a real
PostgreSQL database and covers every module plus the role-based access matrix
from the requirements document (auth, tasks, billing, team/user onboarding,
attendance, leaves, announcements, brands, dashboard, performance, AI/cron/
notifications, and the no-seed bootstrap).

It uses a throwaway database (`scrumfolks_tms_test`) that is created and dropped
automatically, so it never touches demo or production data.

Run it against the Dockerized Postgres without polluting the production image
(test deps are installed into a one-off container, the suite is mounted in):

```bash
# Postgres must be up (docker compose up -d postgres).
docker run --rm --network flowdesk_default \
  -e PYTHONPATH=/app \
  -e TEST_DATABASE_URL="postgresql+psycopg://tms:scrumfolks-demo-pw@postgres:5432/scrumfolks_tms_test" \
  -e DATABASE_URL="postgresql+psycopg://tms:scrumfolks-demo-pw@postgres:5432/scrumfolks_tms_test" \
  -e JWT_SECRET="test-secret" -e CRON_SECRET="test-cron" \
  -v "$PWD/backend/app:/app/app:ro" \
  -v "$PWD/backend/tests:/app/tests:ro" \
  -v "$PWD/backend/pyproject.toml:/app/pyproject.toml:ro" \
  -w /app flowdesk-backend:latest \
  bash -lc "pip install -q 'pytest>=8.2' 'pytest-asyncio>=0.23' && pytest -q"
```

Expected: all tests pass. `DATABASE_URL` is pointed at the test DB so the
bootstrap-admin script (which uses the app's own engine) writes to the same
database the assertions read.

Notes for maintainers:

- Test fixtures must use real email domains (e.g. `@scrumfolks.io`). Pydantic's
  `EmailStr` rejects reserved TLDs like `.test`/`.example`.
- Do not add `from __future__ import annotations` to modules whose endpoints are
  decorated with slowapi's `@limiter.limit` (e.g. `endpoints/auth.py`):
  stringized annotations break FastAPI body-model resolution through the
  decorator wrapper and demote request bodies to query params (HTTP 422).
