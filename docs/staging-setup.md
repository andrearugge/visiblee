# Staging Setup — Visiblee

> **Branch**: `dev`
> **Domain**: `dev.visiblee.ai`
> **Database**: `visiblee_dev` (separate from `visiblee` production)

This document covers the complete procedure for setting up and verifying the staging environment. Follow the steps in order.

---

## 1. DNS

Point `dev.visiblee.ai` to Vercel before configuring anything else.

In your DNS provider (e.g. Cloudflare):

| Type | Name | Value |
|---|---|---|
| CNAME | `dev` | `cname.vercel-dns.com` |

Propagation typically takes a few minutes with Cloudflare (proxied off for Vercel).

---

## 2. Database (Hetzner)

SSH into the Hetzner DB server and run:

```bash
# Create the staging database
psql -U postgres -c "CREATE DATABASE visiblee_dev;"

# Enable pgvector extension
psql -U postgres -d visiblee_dev -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Verify
psql -U postgres -d visiblee_dev -c "\dx"
# Should show: vector | ... | vector data type and ivfflat and hnsw access methods
```

Apply Prisma migrations to the staging database (run from `apps/web` with the staging DB URL):

```bash
DATABASE_URL="postgresql://postgres:<pass>@<hetzner-db-host>:5432/visiblee_dev" \
  npx prisma migrate deploy
```

Seed the superadmin (optional — only if you need admin access on staging):

```bash
DATABASE_URL="postgresql://postgres:<pass>@<hetzner-db-host>:5432/visiblee_dev" \
  npm run db:seed
```

---

## 3. Google OAuth

Go to [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials) and edit the OAuth 2.0 Client used for production.

Add the following **Authorized redirect URIs**:

```
https://dev.visiblee.ai/api/auth/callback/google
https://dev.visiblee.ai/api/gsc/callback
```

Save. Changes are effective within a few minutes.

> The same OAuth client is reused for staging. No separate client needed.

---

## 4. Python microservice (Hetzner — Ploi)

The staging Python service runs on the same Hetzner server as production but as a **separate site/service** on a different port (e.g. `8001`).

### 4.1 — Create a new Ploi site for staging

In Ploi, add a new site on the same server:
- **Domain**: `analyzer-staging.visiblee.ai` (or use the server IP directly)
- **PHP version**: none (Python project)
- **Root**: `/var/www/analyzer-staging`

### 4.2 — Deploy the analyzer code

```bash
# On the Hetzner server, clone the dev branch
git clone -b dev https://github.com/andrearugge/visiblee.git /var/www/analyzer-staging
cd /var/www/analyzer-staging/services/analyzer

# Create venv and install dependencies
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Copy and fill in environment variables
cp .env.example .env
nano .env  # set DATABASE_URL to visiblee_dev, set all API keys
```

### 4.3 — Configure processes

In Ploi, configure two **daemon processes** for the staging site:

**Process 1 — FastAPI (API server)**
```
Command : cd /var/www/analyzer-staging/services/analyzer && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8001
User    : www-data
```

**Process 2 — Job worker**
```
Command : cd /var/www/analyzer-staging/services/analyzer && .venv/bin/python run_worker.py
User    : www-data
```

### 4.4 — Configure scheduler cron

In Ploi → Scheduler, add a new cron job:

```
Command  : cd /var/www/analyzer-staging/services/analyzer && .venv/bin/python -m app.scheduler
Schedule : * * * * *   (every minute)
User     : www-data
```

> The scheduler script connects to the DB, creates jobs if needed, then exits. The OS handles cadence.

### 4.5 — Firewall

Ensure port `8001` is open from Vercel's IP range (or restrict via the `ANALYZER_API_KEY` header — already enforced in the app).

---

## 5. Vercel

### 5.1 — Create a new Vercel project

In the [Vercel dashboard](https://vercel.com/):

1. **New Project** → Import this repository.
2. **Framework Preset**: Next.js.
3. **Root Directory**: `apps/web`.
4. **Build & Output Settings**: leave as default.

### 5.2 — Configure Git branch

Under **Settings → Git**:
- Set the **Production Branch** to `dev`.
- Disable preview deployments for other branches if desired.

### 5.3 — Add domain

Under **Settings → Domains**:
- Add `dev.visiblee.ai`.
- Vercel will verify the CNAME configured in Step 1.

### 5.4 — Environment variables

Under **Settings → Environment Variables**, add all variables from `.env.staging.example` with their staging values. Set scope to **Production** (the `dev` branch in this project).

| Variable | Staging value |
|---|---|
| `DATABASE_URL` | `postgresql://postgres:<pass>@<hetzner-db-host>:5432/visiblee_dev` |
| `NEXTAUTH_URL` | `https://dev.visiblee.ai` |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `APP_URL` | `https://dev.visiblee.ai` |
| `GOOGLE_CLIENT_ID` | same as production |
| `GOOGLE_CLIENT_SECRET` | same as production |
| `ANALYZER_API_URL` | `http://<hetzner-host>:8001` |
| `ANALYZER_API_KEY` | staging internal key (must match `.env` on Hetzner) |
| `GOOGLE_AI_API_KEY` | same as production |
| `VOYAGE_API_KEY` | same as production |
| `BRAVE_SEARCH_API_KEY` | same as production |
| `MAILERSEND_API_KEY` | same as production |
| `EMAIL_FROM` | `noreply@visiblee.ai` |
| `GSC_TOKEN_ENCRYPTION_KEY` | `openssl rand -hex 32` (staging-specific) |
| `GSC_CLIENT_ID` | same as production |
| `GSC_CLIENT_SECRET` | same as production |
| `NEXT_PUBLIC_GSC_ENABLED` | `true` |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | leave empty (no analytics on staging) |

### 5.5 — Trigger first deploy

Push a commit to `dev` or trigger a manual redeploy from the dashboard.

---

## 6. Smoke test checklist

Run through this checklist manually after every staging deployment. Check off each item before merging a phase to `dev`.

### 6.1 — Infrastructure

- [ ] `https://dev.visiblee.ai` loads (no 404, no SSL error)
- [ ] `http://<hetzner-host>:8001/api/v1/health` returns `{"status":"ok"}`
- [ ] `python -m app.scheduler` exits cleanly on the Hetzner server

### 6.2 — Auth

- [ ] `/login` page loads with Google and credentials options
- [ ] Google OAuth login completes and redirects to `/` (app dashboard)
- [ ] Credentials login works with seeded superadmin (`admin@visiblee.dev` / `superadmin123`)
- [ ] `/admin` panel is accessible for superadmin
- [ ] Logout works

### 6.3 — Project flow

- [ ] Create a new project (name, URL, language, country)
- [ ] Content discovery job is created and picked up by the worker
- [ ] `StepLoader` shows while the job runs
- [ ] Discovery results appear (content list with confirm/discard)
- [ ] Confirm a subset of content items
- [ ] Full analysis job completes without error
- [ ] AI Readiness Score and sub-scores appear on the dashboard

### 6.4 — GSC integration

- [ ] GSC connect flow starts from Project Settings
- [ ] OAuth redirect goes to `https://dev.visiblee.ai/api/gsc/callback` (not production)
- [ ] GSC property list appears after OAuth
- [ ] GSC sync job is created and completes

### 6.5 — Citation check

- [ ] Citation check starts for a target query
- [ ] Job completes and citation result appears
- [ ] Sources are shown with expandable quotes

### 6.6 — Email

- [ ] Preview report email is sent after a preview analysis
- [ ] Email links point to `https://dev.visiblee.ai` (not production)

---

## 7. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Vercel deploy fails at `prisma generate` | Missing `DATABASE_URL` | Add to Vercel env vars |
| FastAPI returns 401 | `ANALYZER_API_KEY` mismatch between Vercel and Hetzner | Ensure both use the same staging key |
| GSC OAuth redirect goes to production | Wrong `GSC_CLIENT_ID` or missing redirect URI | Add `dev.visiblee.ai` URI in Google Cloud Console |
| Worker not picking up jobs | Worker process not running | Check Ploi daemons, restart if needed |
| Scheduler fails to connect to DB | `DATABASE_URL` points to wrong DB | Verify `.env` on Hetzner uses `visiblee_dev` |
| Emails go to production users | `MAILERSEND_API_KEY` shared with production | Use a test/sandbox MailerSend key for staging |
