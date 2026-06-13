# Scrumfolks TMS — Deployment Guide

**Goal:** Deploy to tasks.scrumfolks.com  
**Time:** 30–40 minutes total

---

## Step 1 — Supabase (15 min)

1. **Create project** at [supabase.com](https://supabase.com)
   - Name: `scrumfolks-tms`
   - Region: **Southeast Asia (Singapore)**
   - Save the database password somewhere safe

2. **Run the schema**
   - SQL Editor → New query
   - Copy entire contents of `supabase/schema.sql`
   - Paste → Run
   - Should say "Success" — your tables, users, and brands are seeded

3. **Get your keys** — Project Settings → API
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role key (click reveal) → `SUPABASE_SERVICE_ROLE_KEY`

4. **Storage** — Storage → New bucket
   - Name: `tms-files`
   - Public: OFF
   - File size limit: 104857600 (100MB)

---

## Step 2 — Resend (5 min) — for daily emails

1. Sign up at [resend.com](https://resend.com)
2. Add domain: `scrumfolks.com`
3. Add the DNS records they show you in Cloudflare
4. API Keys → Create API Key → copy → `RESEND_API_KEY`

---

## Step 3 — GitHub (5 min)

```bash
cd scrumfolks-tms-next2
git init
git add .
git commit -m "Scrumfolks TMS v1.0"
```

Go to github.com → New repository:
- Name: `scrumfolks-tms`
- Private
- Don't initialize with anything

Then:
```bash
git remote add origin https://github.com/YOURNAME/scrumfolks-tms.git
git branch -M main
git push -u origin main
```

---

## Step 4 — Vercel (10 min)

1. Sign up at [vercel.com](https://vercel.com) with GitHub
2. **Add New → Project** → import `scrumfolks-tms`
3. Framework: Next.js (auto-detected)
4. **Environment Variables** — add all of these:

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | from Step 1.3 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Step 1.3 |
| `SUPABASE_SERVICE_ROLE_KEY` | from Step 1.3 |
| `JWT_SECRET` | generate at https://generate-secret.vercel.app/32 |
| `RESEND_API_KEY` | from Step 2 |
| `CRON_SECRET` | any random 32-char string |
| `NEXT_PUBLIC_APP_URL` | `https://tasks.scrumfolks.com` |

5. **Deploy** → wait ~2 minutes
6. Test the URL Vercel gives you (e.g. `scrumfolks-tms-abc.vercel.app`) — login with `owner@scrumfolks.com` / `scrumfolks2026`

---

## Step 5 — Custom Domain (3 min)

**In Vercel:** Project → Settings → Domains
- Add: `tasks.scrumfolks.com`
- Vercel shows a CNAME record — copy it

**In Cloudflare:** scrumfolks.com → DNS → Add Record
- Type: **CNAME**
- Name: **tasks**
- Target: **cname.vercel-dns.com**
- Proxy: **OFF (grey cloud)**

Wait 2–5 minutes. Open `tasks.scrumfolks.com`. It's live. ✓

---

## Login Credentials

**All users start with password: `scrumfolks2026`**

| Email | Role |
|-------|------|
| owner@scrumfolks.com | Owner (You) |
| manager@scrumfolks.com | Manager |
| team@scrumfolks.com | Team |
| hr@scrumfolks.com | HR |
| accountant@scrumfolks.com | Accountant |
| dev@scrumfolks.com | Developer |
| ravi@scrumfolks.com | Team |
| sonal@scrumfolks.com | Team |
| amit@scrumfolks.com | Manager |

---

## Adding Real Team Members

In Supabase SQL Editor:

```sql
-- Generate password hash at https://bcrypt-generator.com (rounds: 10)
INSERT INTO profiles (name, email, password_hash, role, department, designation, avatar)
VALUES (
  'Full Name',
  'email@scrumfolks.com',
  '$2b$10$YOUR_BCRYPT_HASH_HERE',
  'team',
  'Department',
  'Designation',
  'AB'
);
```

---

## Updating the App

```bash
git add .
git commit -m "Updates"
git push
```

Vercel auto-deploys in ~60 seconds.

---

## Daily Email Cron

Automatically runs:
- **3:30 AM UTC (9:00 AM IST)** — Daily task email to each member
- **2:00 AM UTC (7:30 AM IST)** — File cleanup

To test manually:
```
curl -H "x-cron-secret: YOUR_CRON_SECRET" https://tasks.scrumfolks.com/api/cron/daily-email
```
