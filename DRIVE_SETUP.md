# Google Drive — Scrumfolks TMS

Owner connects **one** Google account. Scrumfolks can then create a real folder per task under **Scrumfolks TMS** in that Drive and attach the link to the task (and emails).

## 1. Google Cloud Console

1. Open [Google Cloud Console](https://console.cloud.google.com/) → create/select a project.
2. **APIs & Services → Enable APIs** → enable **Google Drive API**.
3. **Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - Authorized redirect URI (exact):
     ```
     https://backend-production-d5dd9.up.railway.app/api/v1/drive/callback
     ```
4. Copy **Client ID** and **Client secret**.

## 2. Railway backend variables

```
GOOGLE_OAUTH_CLIENT_ID=<client-id>
GOOGLE_OAUTH_CLIENT_SECRET=<client-secret>
GOOGLE_OAUTH_REDIRECT_URI=https://backend-production-d5dd9.up.railway.app/api/v1/drive/callback
APP_BASE_URL=https://frontend-production-c885.up.railway.app
```

Redeploy backend after setting vars.

## 3. Connect in the app

1. Sign in as **Owner**.
2. **Dashboard → Google Drive → Connect Google Drive**.
3. Approve Drive access (scope: files created by the app only).
4. Open any task → **Files** → **Create Drive folder**.

Managers can create folders after Owner connects. Team still uses the folder links; they do not need Google OAuth.

## Notes

- Pasted Drive links still work without OAuth.
- Uploads inside TMS still use R2/S3 unless you open the Drive folder in Google and upload there.
- To reconnect: Owner → Disconnect, then Connect again (also remove access at https://myaccount.google.com/permissions if Google withholds a refresh token).
