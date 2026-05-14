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
   - **Root directory**: `flowdesk` (if the repo root is `workspace2`, set subdirectory to `flowdesk`).
   - **Build command** (recommended for production DB migrations on each deploy):

     ```bash
     prisma generate && prisma migrate deploy && next build
     ```

   - **Install command**: `npm install` (default).
3. Add environment variable **`DATABASE_URL`** = the same Railway Postgres URL (often append `?sslmode=require` if required).
4. Deploy. After the first successful deploy, run **`npm run db:seed`** once against the same database (from your machine with `DATABASE_URL` in `.env`, or via Railway’s “Run command” if you use that), **or** rely on migrations only and insert seed data manually—seeding is idempotent (`upsert` by task id).

## Build command note

The default `npm run build` in `package.json` is `prisma generate && next build` so local builds work **without** hitting the database. For Vercel, override the build command to include `prisma migrate deploy` so schema changes apply automatically when `DATABASE_URL` is set.

## Security (current scope)

This demo has **no real authentication**: anyone who can open the app can impersonate any team member on the login screen. For production you would add OAuth (e.g. Google), sessions, and enforce roles on every API route.

## Troubleshooting

- **“Database unavailable” on the home screen**: `DATABASE_URL` is missing, wrong, or the DB is not reachable from your machine (local) or from Vercel (firewall / use public URL and SSL).
- **Prisma migrate errors on Vercel**: Ensure `DATABASE_URL` is set for **Production** (and Preview if you use preview deploys) and that the connection allows connections from Vercel’s IPs (Railway public URL usually does).
