# Visiblee

AI Visibility Platform — helps brands, creators, and professionals improve their visibility in AI-powered search (Google AI Mode, ChatGPT, Perplexity, Gemini). Analyzes indexed content, builds an "AI Readiness" profile, and guides users to optimize their content for AI citation.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router) + shadcn/ui + Tailwind CSS v4 |
| i18n | next-intl — Italian + English, no URL prefix |
| Auth | Auth.js v5 — Google OAuth + email/password, JWT sessions |
| Database | PostgreSQL 16 + pgvector |
| ORM | Prisma v7 + @prisma/adapter-pg |
| Python service | FastAPI (analysis, scoring, embeddings) |
| Email | MailerSend |
| Analytics | Google Analytics 4 (marketing site only) |
| Deploy | Vercel (frontend) + Hetzner/Ploi (DB + Python) |

## Prerequisites

- Node.js ≥ 20.19.0
- Python ≥ 3.9 (3.11+ recommended — some Google SDK warnings on 3.9)
- PostgreSQL 16 with pgvector extension (Docker recommended)
- Google OAuth credentials (for social login)

## Local Setup

### 1. Clone and install

```bash
git clone https://github.com/andrearugge/visiblee.git
cd visiblee
npm install
```

### 2. Environment variables

```bash
cp .env.example apps/web/.env
```

Edit `apps/web/.env` and fill in:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/visiblee

AUTH_SECRET=<generate with: openssl rand -base64 32>
AUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>

ANALYZER_API_URL=http://localhost:8000
ANALYZER_API_KEY=dev-internal-key
```

### 3. Start PostgreSQL with pgvector (Docker)

```bash
docker run -d \
  --name visiblee_postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=visiblee \
  -p 5432:5432 \
  pgvector/pgvector:pg16
```

### 4. Run database migrations and seed

```bash
cd apps/web
npx prisma migrate deploy
npm run db:seed   # creates superadmin: admin@visiblee.dev / superadmin123
```

### 5. Set up the Python microservice

```bash
cd services/analyzer

# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy and fill in environment variables
cp .env.example .env
```

Edit `services/analyzer/.env` and fill in your API keys:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/visiblee
ANTHROPIC_API_KEY=<your key>
GOOGLE_AI_API_KEY=<your key>
VOYAGE_API_KEY=<your key>
BRAVE_SEARCH_API_KEY=<your key>
ANALYZER_API_KEY=dev-internal-key
```

### 6. Start development servers

Open **3 separate terminals**:

```bash
# Terminal 1 — Next.js on http://localhost:3000
# From the repo root:
npm run dev:web
# Or from apps/web:
cd apps/web && npm run dev

# Terminal 2 — FastAPI on http://localhost:8000
# Make sure the venv is active first (you'll see (.venv) in the prompt)
cd services/analyzer
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Terminal 3 — Job worker (separate process — processes jobs from the DB)
# Same venv as Terminal 2
cd services/analyzer
source .venv/bin/activate
python run_worker.py
```

Health checks:
- Next.js: `curl http://localhost:3000/api/auth/session` → `{}`
- FastAPI: `curl http://localhost:8000/api/v1/health` → `{"status":"ok"}`

## Project Structure

```
visiblee/
├── apps/
│   └── web/                    # Next.js app
│       ├── app/
│       │   ├── (marketing)/    # Public site + GA4
│       │   ├── (auth)/         # Login / Register
│       │   ├── (app)/          # Authenticated area
│       │   └── (admin)/        # Superadmin panel
│       ├── components/
│       ├── lib/
│       ├── messages/           # en.json, it.json
│       ├── prisma/             # schema + migrations
│       └── types/
├── services/
│   └── analyzer/               # Python FastAPI microservice
├── docs/                       # Project specs and theory
│   ├── visiblee-project-description.md
│   ├── visiblee-specs.md
│   └── visiblee-theory.md
├── CLAUDE.md                   # Development conventions and task tracking
└── package.json                # npm workspaces root
```

## Documentation

- **[CLAUDE.md](./CLAUDE.md)** — conventions, architecture decisions, and phase task tracking
- **[docs/visiblee-specs.md](./docs/visiblee-specs.md)** — full technical specification
- **[docs/visiblee-project-description.md](./docs/visiblee-project-description.md)** — product vision and UX flows
- **[docs/visiblee-theory.md](./docs/visiblee-theory.md)** — Google AI Mode mechanisms and scoring rationale

## Staging Setup

The staging environment runs on the `dev` branch and is deployed to `dev.visiblee.ai`.

### Database

`visiblee_dev` — separate from `visiblee` (production).

```bash
# On the Hetzner DB server, create the staging database:
psql -U postgres -c "CREATE DATABASE visiblee_dev;"
psql -U postgres -c "CREATE EXTENSION IF NOT EXISTS vector;" visiblee_dev

# Apply migrations (from apps/web):
DATABASE_URL=postgresql://postgres:<pass>@<host>:5432/visiblee_dev npx prisma migrate deploy
```

### Vercel

The staging frontend is a **separate Vercel project** connected to the `dev` branch of this repository. It does NOT share the production Vercel project.

**Step-by-step:**

1. In the [Vercel dashboard](https://vercel.com/), create a new project → import this repository.
2. Set the **Root Directory** to `apps/web`.
3. In **Git settings**, configure the project to only deploy from the `dev` branch (disable production branch / set `dev` as the production branch for this project).
4. Under **Settings → Domains**, add `dev.visiblee.ai` and point the DNS CNAME to `cname.vercel-dns.com`.
5. Under **Settings → Environment Variables**, add all variables from `.env.staging.example` with staging values. Mark them as **Production** (since `dev` is treated as production in this project).

Key variables that differ from local `.env`:

| Variable | Staging value |
|---|---|
| `DATABASE_URL` | `postgresql://...@<hetzner-host>:5432/visiblee_dev` |
| `NEXTAUTH_URL` | `https://dev.visiblee.ai` |
| `APP_URL` | `https://dev.visiblee.ai` |
| `ANALYZER_API_URL` | `http://<hetzner-python-host>:8000` |
| `NEXT_PUBLIC_GSC_ENABLED` | `true` |

### Google OAuth

Add the staging callback URL to the Google Cloud Console OAuth credentials (same project as production):

- **Authorized redirect URI**: `https://dev.visiblee.ai/api/auth/callback/google`
- **GSC OAuth redirect URI**: `https://dev.visiblee.ai/api/gsc/callback`

### Python microservice

The staging Python service runs on the same Hetzner server as production but on a **different port** (e.g., `8001`). Configure Ploi to run a second site/service for the `dev` branch. Point `ANALYZER_API_URL` in the Vercel staging environment to the staging port.

For the complete staging setup procedure (including DNS and Ploi config), see `docs/staging-setup.md` (created in Phase 0, Task 0.5).

---

## Known Issues / Notes

| Issue | Status | Notes |
|---|---|---|
| `fanout_coverage_score` always 0 | ⚠️ To investigate | Voyage AI embeddings may not be generating correctly despite key being set. Fanout queries count stays at the original number instead of expanding. Verify once preview UI (Task 2.5) is complete. |
| Python 3.9 Google SDK warnings | ℹ️ Non-blocking | `google-auth` and `google-genai` show FutureWarning on Python 3.9. Upgrade to Python 3.11+ to suppress. |

## Superadmin Access

After seeding, access the admin panel at `/admin` using:

- Email: `admin@visiblee.dev`
- Password: `superadmin123`

> Change these credentials before any staging/production deployment.
