# FlowDesk: go live (Railway + Vercel)

FlowDesk is **Next.js on Vercel** and **PostgreSQL on Railway**. Tasks are stored in Postgres via Prisma.

**Repo:** [github.com/Mustafi2703/flowdesk](https://github.com/Mustafi2703/flowdesk)  
**What the app does (product):** see **[`OVERVIEW.md`](./OVERVIEW.md)** in this repo.

Do **Railway first** (database + URL), then **Vercel** (env + build + deploy), then **seed** once.

---

## First time: create PostgreSQL on Railway

You have **not** created a database yet — follow this once. On Railway you do **not** attach a “Postgres volume” as a separate step like on a VPS; you add a **PostgreSQL database service** and Railway provisions storage for you.

1. Go to **[railway.app](https://railway.app)** and sign in (GitHub login is common).
2. From the workspace dashboard, click **New Project**.
3. Choose one of:
   - **Deploy PostgreSQL** / **Provision PostgreSQL** (if the template appears), **or**
   - **Empty project**, then inside the project click **+ New** → **Database** → **PostgreSQL**.
4. Wait until the **PostgreSQL** service shows as running (green / active). Railway creates default credentials and injects **`DATABASE_URL`** into that service’s environment.
5. Open the **PostgreSQL** service card → **Variables** tab. Locate **`DATABASE_URL`**. That value is what Prisma uses on Railway’s private network (often with a host like `*.railway.internal`).
6. **For Vercel** (builds and serverless functions run on the public internet), you need a connection string that works **from outside Railway**:
   - Open the Postgres service → **Settings** (gear) or **Networking**.
   - Enable **public networking** / **TCP proxy** if Railway offers it for this database.
   - After enabling, check **Variables** again: Railway often adds something like **`DATABASE_PUBLIC_URL`** or updates the connect docs with a **public host and port**. Use that full URL in Vercel as **`DATABASE_URL`**.
   - If the URL does not already include SSL parameters, try appending **`?sslmode=require`** (some clients require it).
7. **Copy the final URL** you will use on Vercel. Optionally paste the same into a local **`.env`** file in the `flowdesk` repo for `npm run db:seed` (see Part C).

If anything is unclear in the Railway UI (names change over time), use Railway’s own **Connect** / **Postgres** instructions from the service page; the goal is always: **one Postgres instance + one public `DATABASE_URL` for Vercel**.

---

## Part A — Railway (Postgres) — recap

1. **Log in** at [railway.app](https://railway.app) and open your team or personal workspace.

2. **New project** → **Empty project** (or **Deploy PostgreSQL** if you see a one-click template).

3. **Add PostgreSQL**
   - Click **+ New** → **Database** → **PostgreSQL**.
   - Wait until the database shows as **Active**.

4. **Get the connection URL**
   - Open the **Postgres** service card.
   - Go to the **Variables** tab (or **Connect**).
   - Find **`DATABASE_URL`** (Railway injects it automatically). Click **copy** (or reveal and copy the full URL).
   - It usually looks like:  
     `postgresql://postgres:PASSWORD@HOST.railway.internal:5432/railway`  
     For **Vercel**, you need a URL that is reachable **from the public internet**, not only from Railway’s private network.

5. **Public URL for Vercel (important)**
   - In the Postgres service, open **Settings** (or **Networking** / **Connect**).
   - Enable **Public networking** / **TCP Proxy** if Railway shows that option, **or** use the **`DATABASE_PUBLIC_URL`** (or “public URL”) variable Railway provides when public access is on.
   - Your Vercel env value should be the **public** Postgres URL. If the URL contains `railway.internal`, it will **not** work from Vercel until you use the public host Railway documents for external clients.
   - Append SSL if your client needs it, e.g. **`?sslmode=require`** at the end of the URL (many hosted Postgres setups expect this).

6. **Keep this tab open** — you will paste the same URL into Vercel as **`DATABASE_URL`**.

*(Optional, local testing)* In the `flowdesk` folder on your laptop:

```bash
cp .env.example .env
# Put DATABASE_URL=... in .env, then:
npm install
npx prisma migrate deploy
npm run db:seed
```

That creates tables and loads the **seven demo tasks**. You will run **`db:seed`** again after Vercel can reach the same database (see Part C).

---

## Part B — Vercel (app + Git)

Assume you already **imported the GitHub repo** and connected it to the Vercel project (“flow” / FlowDesk project).

1. **Open the project** in the Vercel dashboard: [vercel.com/dashboard](https://vercel.com/dashboard) → select **flowdesk** (or your project name).

2. **Root Directory**
   - **Settings** → **General**.
   - If the Git repo root **is** only FlowDesk code, leave **Root Directory** empty / `.`
   - If the repo is a **monorepo**, set **Root Directory** to the folder that contains `package.json` (e.g. `flowdesk`).

3. **Framework**
   - Vercel should auto-detect **Next.js**. If not, set **Framework Preset** to **Next.js**.

4. **Environment variable (required for a working app)**
   - **Settings** → **Environment Variables**.
   - Add:
     - **Name:** `DATABASE_URL`
     - **Value:** paste the **public** Railway Postgres URL (from Part A).
     - **Environment:** enable at least **Production** (and **Preview** if you want preview deployments to use the same DB).
   - **Save**.

5. **Build command (run migrations on each deploy)**
   - **Settings** → **General** → scroll to **Build & Development Settings**.
   - **Override** the **Build Command** to:

   ```bash
   prisma generate && prisma migrate deploy && next build
   ```

   - Leave **Install Command** as `npm install` (default).
   - **Save**.

   *Note:* The repo’s `vercel.json` may still say `prisma generate && next build`. The **dashboard override** wins when set; use the line above so Vercel creates/updates tables on Railway when you deploy.

6. **Redeploy**
   - **Deployments** tab → open the latest deployment → **⋯** → **Redeploy** (check “Use existing Build Cache” only if you are sure; for a clean DB migration, **uncheck** cache once).
   - Or push a small commit to `main` on GitHub to trigger a new deployment.

7. **Production URL**
   - **Settings** → **Domains** to see or add your domain (e.g. `flowdesk-olive.vercel.app` or a custom domain).

If the build fails on **`prisma migrate deploy`**, the usual causes are: wrong **`DATABASE_URL`**, URL still **private-only**, or SSL — fix the URL in Vercel env and redeploy.

---

## Part C — Seed demo tasks (once)

After **Part B** succeeds (green build, site opens):

1. On your laptop, in the cloned `flowdesk` repo, set **`.env`** with the **same** `DATABASE_URL` Vercel uses (public Railway URL).

2. Run:

```bash
npm install
npm run db:seed
```

Seeding is **idempotent** (same task IDs are upserted). You only need this once per empty database (or after you reset the DB).

3. Open your **Vercel production URL** — you should get past “Loading tasks…” and see the **login** screen with team members; tasks load from the API.

---

## Quick checklist

| Step | Where | Action |
|------|--------|--------|
| 1 | Railway | Create PostgreSQL, enable **public** access, copy **public** `DATABASE_URL` |
| 2 | Vercel | Add env var **`DATABASE_URL`** (Production) |
| 3 | Vercel | Build command: `prisma generate && prisma migrate deploy && next build` |
| 4 | Vercel | Redeploy / push to `main` |
| 5 | Laptop | `npm run db:seed` with same `DATABASE_URL` |

---

## Security (current demo)

There is **no real login**. Anyone with the URL can pick any profile. For production, add real auth (e.g. OAuth) and protect API routes.

---

## Troubleshooting

| Symptom | What to check |
|---------|----------------|
| Stuck on “Loading tasks…” then error | **`DATABASE_URL`** missing or wrong on Vercel; or DB not **public** from the internet |
| Build fails at `migrate deploy` | URL, SSL (`?sslmode=require`), Railway Postgres running |
| Site loads but no tasks | Run **`npm run db:seed`** locally against the same DB |

Railway docs: [docs.railway.app](https://docs.railway.app)  
Vercel + environment variables: [vercel.com/docs/projects/environment-variables](https://vercel.com/docs/projects/environment-variables)
