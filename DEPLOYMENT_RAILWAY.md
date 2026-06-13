# Railway Deployment — Scrumfolks TMS

Use this guide for demo and client deployments from GitHub. Each client can
have its own Railway **project** (recommended) connected to their repo branch.

## 1. Fix "GitHub Repo not found"

This means Railway’s GitHub App cannot see the repository.

1. Open **GitHub → Settings → Applications → Installed GitHub Apps → Railway**
2. Click **Configure**
3. Under **Repository access**, choose **All repositories** or select
   `Mustafi2703/flowdesk` (and any other client repos)
4. Save
5. In Railway: open the service → **Settings → Source** → **Connect Repo**
6. Pick `Mustafi2703/flowdesk`, branch **`main`**, environment **production**

The repo is public at https://github.com/Mustafi2703/flowdesk — if it is still
not listed, confirm you are in the correct Railway workspace
(**QRYX TECH PRIVATE LIMITED**).

## 2. Monorepo layout (this repo)

Three Railway services in one project:

| Service   | Dockerfile (repo root)   | Watch paths      |
|-----------|--------------------------|------------------|
| Postgres  | (Railway template)       | —                |
| backend   | `Dockerfile.backend`     | `backend/**`     |
| frontend  | `Dockerfile.frontend`    | `frontend/**`    |

Do **not** set a Root Directory on GitHub-connected services — the root
Dockerfiles copy from `backend/` and `frontend/` with the repository root as
build context.

In each service **Settings → Build**:

- Builder: **Dockerfile**
- Dockerfile path: `Dockerfile.backend` or `Dockerfile.frontend`

Or set variable `RAILWAY_DOCKERFILE_PATH` to the same value.

Config-as-code (optional): point to `/backend/railway.toml` or
`/frontend/railway.toml` for healthcheck and restart policy only.

## 3. Branch → production

In **Settings → Source** for each app service:

- **Branch connected to production:** `main`
- Changes pushed to `main` auto-deploy to the production environment

For multiple clients later:

- **Option A (recommended):** one Railway project per client repo
- **Option B:** one repo, branch per client (`client-acme`, `client-foo`) and
  map each branch to a Railway environment

## 4. Required environment variables

### Backend

```env
APP_ENV=production
APP_DEBUG=false
SEED_DEMO=true
SEED_PASSWORD=scrumfolks2026
JWT_SECRET=<openssl rand -hex 32>
CRON_SECRET=<openssl rand -hex 32>
COOKIE_SECURE=true
COOKIE_SAMESITE=lax
DATABASE_URL=${{Postgres.DATABASE_URL}}
ALLOWED_HOSTS=["*"]
ALLOWED_ORIGINS=["https://YOUR-FRONTEND.up.railway.app"]
GUNICORN_WORKERS=2
EMAIL_PROVIDER=console
ENABLE_SCHEDULER=false
RAILWAY_DOCKERFILE_PATH=Dockerfile.backend
```

### Frontend

```env
JWT_SECRET=<same as backend>
CRON_SECRET=<same as backend>
FASTAPI_BASE_URL=https://YOUR-BACKEND.up.railway.app
NEXT_PUBLIC_APP_URL=https://YOUR-FRONTEND.up.railway.app
NODE_ENV=production
RAILWAY_DOCKERFILE_PATH=Dockerfile.frontend
```

After generating domains, update `ALLOWED_ORIGINS`, `APP_BASE_URL`, and
`NEXT_PUBLIC_APP_URL`, then redeploy backend.

## 5. Demo login

After first successful deploy (`SEED_DEMO=true`):

- URL: frontend Railway domain → `/login`
- Email: `owner@scrumfolks.com`
- Password: `scrumfolks2026`

## 6. Current project

- Project: **scrumfolks-tms**
- Dashboard: https://railway.com/project/6d64c844-14e2-4cd0-b08e-b902c433c427
- Backend: https://backend-production-d5dd9.up.railway.app
