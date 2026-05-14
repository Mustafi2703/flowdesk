# FlowDesk deployment

FlowDesk is a **Next.js 15** app on **Vercel** with **PostgreSQL** on **Railway** (or any Postgres). Tasks are stored in the database; the UI is the same FlowDesk prototype you started from.

## What you need

| Item | Purpose |
|------|---------|
| **Vercel account** | Hosts the Next.js app and API routes (`/api/tasks`). |
| **Railway Postgres** (or other Postgres) | Persists tasks and timelines. |
| **`DATABASE_URL`** | Prisma connection string (set locally in `.env` and in Vercel **Environment Variables**). |

Optional: **GitHub** (or GitLab) repo connected to Vercel for automatic deploys on push.

## One-time database setup

1. In Railway, create a **PostgreSQL** service.
2. Open **Variables** (or Connect) and copy `DATABASE_URL`.
3. Locally, in `flowdesk/`:

   ```bash
   cp .env.example .env
   # paste DATABASE_URL into .env
   npm install
   npx prisma migrate deploy
   npm run db:seed
   ```

   That creates the `tasks` table and loads the **seven seed tasks** from `prisma/seed-data.ts`.

## Deploy on Vercel

1. Push the `flowdesk` folder to a Git repository (or use Vercel CLI: `npx vercel` from `flowdesk/`).
2. In the Vercel project:
   - **Root directory**: leave default if the Git repo root **is** the `flowdesk` folder (this repo). If you import a monorepo, set the subdirectory to `flowdesk`.
   - **Build command**: the repo’s `vercel.json` uses `prisma generate && next build` so the **first** deploy works even before `DATABASE_URL` exists (the app will show a database setup message until you add it).
   - **Install command**: `npm install` (default).
3. Add environment variable **`DATABASE_URL`** = your Railway Postgres URL (often append `?sslmode=require`).
4. In Vercel → **Settings → General → Build & Development Settings**, set **Build Command** to:

   ```bash
   prisma generate && prisma migrate deploy && next build
   ```

   Redeploy so the `tasks` table is created on Railway.
5. Run **`npm run db:seed`** once (from your laptop with `DATABASE_URL` in `.env`) to load the **seven demo tasks**. Seeding is idempotent (`upsert` by task id).

## Build command note

`package.json` `build` is `prisma generate && next build` so local builds do not require a running database. After `DATABASE_URL` is configured on Vercel, use the build command in step 4 so each deploy runs **`prisma migrate deploy`** against production.

## Security (current scope)

This demo has **no real authentication**: anyone who can open the app can impersonate any team member on the login screen. For production you would add OAuth (e.g. Google), sessions, and enforce roles on every API route.

## Troubleshooting

- **“Database unavailable” on the home screen**: `DATABASE_URL` is missing, wrong, or the DB is not reachable from your machine (local) or from Vercel (firewall / use public URL and SSL).
- **Prisma migrate errors on Vercel**: Ensure `DATABASE_URL` is set for **Production** (and Preview if you use preview deploys) and that the connection allows connections from Vercel’s IPs (Railway public URL usually does).
