# Storage & scale for ~50 team members

Target: **50 users**, brand/task documents up to **100 MB**, chats + tasks without filling Postgres.

## Architecture

| Layer | Role |
|-------|------|
| **Postgres (Railway)** | Users, tasks, brands, chats, notifications, **file metadata only** |
| **Cloudflare R2** (S3 API) | Document **bytes** (logos, briefs, reviews) |
| **Frontend proxy** | Uploads up to ~110 MB (already raised) |

Without R2 env vars, uploads still work via Postgres `file_data` (fine for demos; not for heavy production docs).

---

## 1. Enlarge Postgres (Railway)

Current volume is typically **5 GB**. Metadata for 50 users is tiny; grow disk if you keep any legacy BYTEA files.

In Railway → **Postgres** → **Volume**:
- Raise storage toward **20–50 GB** if you expect many large DB-backed files before R2 is on.
- Or leave at 5–10 GB once **all new uploads go to R2**.

Optional env on **backend** (already defaults):
```
DATABASE_POOL_SIZE=30
DATABASE_MAX_OVERFLOW=20
```

---

## 2. Cloudflare R2 bucket (recommended)

1. Cloudflare dashboard → **R2** → Create bucket (e.g. `scrumfolks-docs`).
2. **Manage R2 API Tokens** → create Access Key ID + Secret.
3. Note Account ID. Endpoint:
   `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
4. Railway → **backend** → Variables:

```
S3_BUCKET=scrumfolks-docs
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_ENDPOINT_URL=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
S3_REGION=auto
S3_PREFIX=uploads
```

5. Redeploy **backend**. New uploads store in R2; DB only keeps name/size/review status.

Same vars work for **AWS S3** if you omit `S3_ENDPOINT_URL` and set `S3_REGION` (e.g. `ap-south-1`).

---

## 3. Team of 50

- No hard cap in code — Owner adds members in **Team**.
- Roles: Owner / Manager / Team / HR / Accounts.
- Multi-manager + brand allocation already support many members.
- Connection pool sized for concurrent use by ~50 people.

---

## 4. Checklist

- [ ] Create R2 bucket + API token  
- [ ] Set the six `S3_*` vars on Railway backend  
- [ ] Redeploy backend (migration `0010_object_storage_key` runs on boot)  
- [ ] Upload a test file on Brands/Tasks → confirm it appears; optionally check R2 console  
- [ ] (Optional) Grow Postgres volume if keeping old DB blobs  
