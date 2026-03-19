# CLAUDE.md — Visiblee

## What is this project?
Visiblee is a SaaS web app that helps brands, creators, and professionals improve their visibility in AI-powered search (Google AI Mode, AI Overviews, ChatGPT, Perplexity, Gemini). It analyzes indexed content, builds an "AI Readiness" profile based on documented Google patents, and guides users to optimize their content for AI citation.

## Reference documents
Before making any architectural or implementation decision, consult these project knowledge documents:
- **visiblee-project-description.md** — Product vision, target users, funnel, i18n, score naming, sections, wizard/onboarding
- **visiblee-specs.md** — Full technical specs: architecture, DB schema, API design, UX flows, scoring implementation, email, analytics, dev phases, conventions
- **visiblee-theory.md** — Google AI Mode mechanisms, patents, scoring rationale, literature

These are the source of truth. Do not invent details — if something isn't covered, flag it and propose a solution consistent with the existing architecture.

## Tech stack
- **Frontend**: Next.js 14+ (App Router) + shadcn/ui + Tailwind CSS
- **i18n**: next-intl — Italian + English, browser detection, no URL prefix, routes always in English
- **Auth**: Auth.js v5 (NextAuth) — Google OAuth + email/password, JWT sessions
- **Database**: PostgreSQL + pgvector
- **ORM**: Prisma
- **Python microservice**: FastAPI (analysis, scoring, embedding — separate Hetzner server in production)
- **Email**: MailerSend (transactional emails, PDF report)
- **Analytics**: Google Analytics 4 (marketing site only)
- **Deploy**: Vercel (frontend) + Hetzner via Ploi (2 servers: DB + Python)

## Project structure (target)
```
visiblee/
├── apps/
│   └── web/                        # Next.js app
│       ├── app/
│       │   ├── (marketing)/        # Public site + GA4
│       │   ├── (auth)/             # Login / Register
│       │   ├── (app)/              # Authenticated area
│       │   │   └── app/
│       │   │       └── projects/[id]/
│       │   │           ├── overview/
│       │   │           ├── queries/
│       │   │           ├── contents/
│       │   │           ├── opportunities/
│       │   │           ├── competitors/
│       │   │           ├── optimization/
│       │   │           ├── agent/
│       │   │           └── settings/
│       │   ├── (admin)/            # Superadmin panel
│       │   └── api/                # API Routes
│       ├── components/
│       │   ├── ui/                 # shadcn/ui
│       │   ├── layout/            # Shells, Sidebar, Navbar
│       │   ├── analytics/         # GA component
│       │   ├── onboarding/        # Wizard, explainers, empty states
│       │   └── features/          # Feature-specific components
│       ├── lib/
│       ├── i18n/
│       ├── messages/              # en.json, it.json
│       └── prisma/
├── services/
│   └── analyzer/                   # Python FastAPI microservice
├── CLAUDE.md
└── package.json
```

## Conventions

### Code style
- **Database**: snake_case (tables and columns). Technical names only — no user-friendly names in schema.
- **TypeScript**: camelCase variables, PascalCase types/components
- **Python**: snake_case everything, PascalCase classes
- **API routes**: kebab-case URLs
- **Files**: kebab-case for files, PascalCase for React components
- **i18n keys**: camelCase with dot notation namespaces (e.g. `scores.queryReach.description`)

### Score naming
Technical names in code/DB/API. User-friendly names ONLY in i18n translation files, never hardcoded:
| Code name | UI name |
|---|---|
| `ai_readiness_score` | AI Readiness Score |
| `fanout_coverage_score` | Query Reach |
| `passage_quality_score` | Answer Strength |
| `chunkability_score` | Extractability |
| `entity_coherence_score` | Brand Trust |
| `cross_platform_score` | Source Authority |

### Git
- Branches: `feature/name`, `fix/name`, `refactor/name`
- Commits: conventional (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`)
- One commit = one logical unit of work. Never multi-feature commits.

### i18n rules
- No language prefix in URLs. Ever. Routes are always English.
- Language detected from browser `Accept-Language` → cookie `NEXT_LOCALE` → fallback `en`.
- Language selector: footer of marketing site only. In authenticated area: Settings page only.
- AI-generated content (insights, recommendations) uses `language` parameter in LLM prompts.

### Development principles
- **Atomic tasks**: each task is self-contained and completable in isolation.
- **Verify before proceeding**: each step must be tested and working before starting the next.
- **Update this file**: after completing each task, update the status below.

---

## Current state

**Phase**: 3 — Content discovery & authenticated app
**Status**: IN PROGRESS
**Last completed task**: Task 2.7 — Registration conversion from preview

---

## Phase 1 — Foundation (atomic tasks)

Complete these tasks in order. Each task is one commit. Verify each works before proceeding to the next.

### Task 1.1 — Monorepo scaffold
**Status**: DONE
**Goal**: Create the base monorepo structure with Next.js app and Python microservice placeholder.

**Steps**:
1. Initialize the root `package.json` with npm workspaces pointing to `apps/web`
2. Create Next.js app in `apps/web/` using `npx create-next-app@latest` with App Router, TypeScript, Tailwind CSS, ESLint, `src/` directory disabled (files directly in `app/`), import alias `@/`
3. Create Python microservice scaffold in `services/analyzer/`:
   - `app/main.py` with minimal FastAPI app and `/api/v1/health` endpoint
   - `requirements.txt` with `fastapi`, `uvicorn`
4. Create `docs/` directory with empty `architecture/` and `api/` subdirs
5. Create `.env.example` at root with all env variables from specs (no real values)
6. Create `.gitignore` covering Node, Python, `.env`, `.next`, `__pycache__`, `node_modules`

**Verify**: `cd apps/web && npm run dev` starts Next.js on port 3000. `cd services/analyzer && uvicorn app.main:app` starts FastAPI on port 8000. Health endpoint returns `{"status": "ok"}`.

**Commit**: `feat: scaffold monorepo with Next.js app and Python microservice`

---

### Task 1.2 — shadcn/ui setup
**Status**: DONE
**Goal**: Initialize shadcn/ui in the Next.js app.

**Steps**:
1. Run `npx shadcn@latest init` in `apps/web/` — choose: New York style, Zinc base color, CSS variables
2. Install initial components: `button`, `card`, `input`, `label`, `separator`, `sheet`, `dropdown-menu`, `avatar`, `badge`, `tooltip`, `dialog`
3. Verify `components/ui/` directory is populated

**Verify**: Import and render a `<Button>` in the root `page.tsx`. It renders correctly with styling.

**Commit**: `feat: initialize shadcn/ui with base components`

---

### Task 1.3 — i18n setup with next-intl
**Status**: DONE
**Goal**: Set up next-intl for Italian + English with browser detection, no URL prefix.

**Steps**:
1. Install `next-intl`
2. Create `i18n/config.ts`:
   ```ts
   export const locales = ['en', 'it'] as const;
   export type Locale = (typeof locales)[number];
   export const defaultLocale: Locale = 'en';
   ```
3. Create `i18n/request.ts` with `getRequestConfig` that reads locale from cookie `NEXT_LOCALE` or `Accept-Language` header, falling back to `en`
4. Create `messages/en.json` and `messages/it.json` with initial structure:
   ```json
   {
     "common": { "save": "Save", "cancel": "Cancel", "loading": "Loading...", "error": "Error" },
     "nav": {
       "overview": "Overview", "queries": "Queries", "contents": "Contents",
       "opportunityMap": "Opportunity Map", "competitors": "Competitors",
       "optimizationTips": "Optimization Tips", "geoExpert": "GEO Expert",
       "settings": "Settings", "projects": "Projects", "notifications": "Notifications"
     },
     "scores": {
       "aiReadiness": "AI Readiness Score",
       "queryReach": "Query Reach", "queryReach.description": "How many related questions your content can answer",
       "answerStrength": "Answer Strength", "answerStrength.description": "How strong each paragraph is in competition",
       "extractability": "Extractability", "extractability.description": "How easily AI can extract information from your content",
       "brandTrust": "Brand Trust", "brandTrust.description": "How recognizable and consistent your brand is",
       "sourceAuthority": "Source Authority", "sourceAuthority.description": "How present you are across diverse, authoritative sources"
     }
   }
   ```
   (Italian file with translated values, score names stay in English as per specs)
5. Create `middleware.ts` at `apps/web/` root — uses `next-intl` middleware to detect locale without URL rewriting
6. Wrap the root layout with `NextIntlClientProvider`
7. Test: create a simple page that uses `useTranslations('common')` and renders a translated string

**Verify**: Page shows "Save" with English browser. Changing browser language to Italian shows "Salva". URL does not change.

**Commit**: `feat: setup next-intl i18n with browser detection, no URL prefix`

---

### Task 1.4 — Route groups and layouts
**Status**: DONE
**Goal**: Create the 4 route groups with their layouts and all placeholder pages.

**Steps**:
1. Create route group `(marketing)/` with `layout.tsx`:
   - Public navbar: Logo, Pricing link, About link, Login link
   - Footer: links, legal, language selector `[IT|EN]`
   - Slot for `{children}`
2. Create route group `(auth)/` with `layout.tsx`:
   - Centered, minimal layout (logo + card)
3. Create route group `(app)/` with `layout.tsx`:
   - App shell: top navbar (Logo, notifications icon, user avatar dropdown) + sidebar
   - Sidebar: Projects, Settings. Admin section (Users) visible only if superadmin.
   - Requires auth (redirect to `/login` if not authenticated — placeholder logic for now)
4. Create route group `(admin)/` with `layout.tsx`:
   - Admin shell, reuses app layout patterns
   - Placeholder access check
5. Create all placeholder pages (each returns a simple card with the page name and an empty state message):

   **Marketing**:
   - `(marketing)/page.tsx` → Landing page (`/`)
   - `(marketing)/preview/[id]/page.tsx` → Preview result
   - `(marketing)/pricing/page.tsx` → Pricing (future)
   - `(marketing)/about/page.tsx` → About (future)

   **Auth**:
   - `(auth)/login/page.tsx`
   - `(auth)/register/page.tsx`

   **App**:
   - `(app)/app/page.tsx` → Dashboard
   - `(app)/app/projects/new/page.tsx` → New project wizard
   - `(app)/app/projects/[id]/layout.tsx` → Project sidebar layout
   - `(app)/app/projects/[id]/overview/page.tsx`
   - `(app)/app/projects/[id]/queries/page.tsx`
   - `(app)/app/projects/[id]/contents/page.tsx`
   - `(app)/app/projects/[id]/contents/[cId]/page.tsx`
   - `(app)/app/projects/[id]/opportunities/page.tsx`
   - `(app)/app/projects/[id]/competitors/page.tsx`
   - `(app)/app/projects/[id]/optimization/page.tsx`
   - `(app)/app/projects/[id]/agent/page.tsx`
   - `(app)/app/projects/[id]/settings/page.tsx`
   - `(app)/app/settings/page.tsx` → User settings (with language selector)
   - `(app)/app/notifications/page.tsx`

   **Admin**:
   - `(admin)/admin/page.tsx` → Admin dashboard
   - `(admin)/admin/users/page.tsx` → User list
   - `(admin)/admin/users/[id]/page.tsx` → User detail

6. Project sidebar (`(app)/app/projects/[id]/layout.tsx`) must show:
   - Overview, Queries, Contents, Opportunity Map, Competitors, Optimization Tips, GEO Expert (main section)
   - Settings (bottom section)
   - Use translated labels from `nav` namespace
   - Highlight active route

**Verify**: Navigate to every route — each renders its placeholder. Sidebar navigation works within a project. Marketing layout has navbar + footer with language switcher. App layout has sidebar. All labels are translated.

**Commit**: `feat: create route groups, layouts, and placeholder pages`

---

### Task 1.5 — Prisma setup and database schema
**Status**: DONE
**Goal**: Set up Prisma with the full database schema for Phase 1 tables.

**Steps**:
1. Install `prisma` and `@prisma/client` in `apps/web/`
2. Run `npx prisma init` — creates `prisma/schema.prisma` and `.env`
3. Configure `DATABASE_URL` in `.env` pointing to local PostgreSQL
4. Define the Prisma schema translating the SQL from `visiblee-specs.md` section 2.1. For Phase 1, include ALL tables (the full schema — we want the DB ready even if we don't use all tables immediately):
   - `User` (with `preferredLocale` field)
   - `Account`, `Session` (NextAuth)
   - `PreviewAnalysis` (with `reportEmail`, `reportSentAt`, `locale`)
   - `Project`
   - `TargetQuery`, `FanoutQuery`
   - `Content`, `Passage`
   - `Competitor`, `CompetitorContent`, `CompetitorPassage`
   - `ProjectScoreSnapshot`, `ContentScore`, `PassageScore`
   - `FanoutCoverageMap`
   - `Recommendation`
   - `Job`
   - `Notification`
5. Use `uuid` for all IDs with `@default(uuid())`
6. Add pgvector extension via `@@map` and raw SQL in a migration for the `vector` columns (Prisma doesn't natively support pgvector — use `Unsupported("vector(1024)")` type)
7. Create `lib/db.ts` with singleton Prisma client pattern
8. Run `npx prisma migrate dev --name init` to create and apply migration

**Verify**: `npx prisma studio` opens and shows all tables. Tables match the schema in `visiblee-specs.md`.

**Commit**: `feat: setup Prisma with full database schema`

---

### Task 1.6 — Authentication with Auth.js v5
**Status**: DONE
**Goal**: Set up Auth.js v5 with Google OAuth + email/password (credentials).

**Steps**:
1. Install `next-auth@beta` and `@auth/prisma-adapter`
2. Create `lib/auth.ts` with Auth.js v5 configuration:
   - Prisma adapter
   - Google provider (reads `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`)
   - Credentials provider (email + password, bcrypt hash verification)
   - JWT strategy (not database sessions)
   - Callbacks: include `user.id`, `user.role`, `user.preferredLocale` in JWT and session
3. Create `app/api/auth/[...nextauth]/route.ts` handler
4. Build login page `(auth)/login/page.tsx`:
   - "Continue with Google" button
   - Email + password form
   - Link to register page
5. Build register page `(auth)/register/page.tsx`:
   - Name, email, password fields
   - "Continue with Google" button
   - On register: hash password with bcrypt, create user with `preferredLocale` from current cookie/browser
6. Protect `(app)/` layout: check session, redirect to `/login` if not authenticated
7. Protect `(admin)/` layout: check session + `role === 'superadmin'`, redirect if unauthorized
8. Add user menu dropdown in app navbar: name, email, "Settings", "Sign out"

**Verify**: Can register with email/password. Can login with email/password. Can login with Google OAuth (if credentials configured). Accessing `/app` without auth redirects to `/login`. Non-superadmin accessing `/admin` gets redirected. Session persists across page refreshes.

**Commit**: `feat: setup Auth.js v5 with Google OAuth and credentials`

---

### Task 1.7 — CRUD Projects
**Status**: DONE
**Goal**: Implement project creation, listing, editing, and deletion.

**Steps**:
1. API routes:
   - `GET /api/projects` — list projects for current user (with auth check)
   - `POST /api/projects` — create project (body: `name`, `brandName`, `websiteUrl`, `description`)
   - `GET /api/projects/[id]` — get project detail (verify ownership)
   - `PATCH /api/projects/[id]` — update project
   - `DELETE /api/projects/[id]` — delete project (soft: set status to `archived`)
2. Dashboard page `(app)/app/page.tsx`:
   - List user's projects as cards (name, brand, website, status, created date)
   - "New project" button → navigates to `/app/projects/new`
   - Empty state: educational message about what projects are for
3. New project page `(app)/app/projects/new/page.tsx`:
   - Simple form (not the full 3-step wizard yet): brand name, website URL, project name, 3 target queries
   - On submit: create project + create target queries → redirect to `/app/projects/[id]/overview`
4. Project settings page `(app)/app/projects/[id]/settings/page.tsx`:
   - Edit project name, brand name, website URL, description
   - Delete project button (with confirmation dialog)
5. Ensure project sidebar shows the project name in the navbar breadcrumb

**Verify**: Can create a project from dashboard. Project appears in list. Can navigate to project overview. Can edit project settings. Can delete project. Other users cannot see/edit the project.

**Commit**: `feat: implement CRUD projects with dashboard and settings`

---

### Task 1.8 — Admin panel (base)
**Status**: DONE
**Goal**: Build superadmin panel with user management.

**Steps**:
1. API routes (superadmin only):
   - `GET /api/admin/users` — list all users (with pagination, search by email/name)
   - `GET /api/admin/users/[id]` — user detail with project count
   - `PATCH /api/admin/users/[id]` — update user role
   - `GET /api/admin/users/[id]/projects` — list user's projects (read-only)
2. Admin dashboard `(admin)/admin/page.tsx`:
   - Cards: total users, total projects, active projects
3. Admin users page `(admin)/admin/users/page.tsx`:
   - Table: email, name, role, projects count, provider (Google/credentials), preferred locale, created date
   - Search input, filter by role
   - Click row → navigate to user detail
4. Admin user detail `(admin)/admin/users/[id]/page.tsx`:
   - User info card
   - Role selector (user / admin / superadmin) with save
   - List of user's projects (read-only, link to view)
5. Seed script: `npx prisma db seed` — creates a superadmin user for local development

**Verify**: Superadmin can view all users. Can change user roles. Can see user's projects. Non-superadmin gets 403 on admin API routes.

**Commit**: `feat: implement admin panel with user management`

---

### Task 1.9 — User settings page
**Status**: DONE
**Goal**: Build user account settings with language preference.

**Steps**:
1. API route `PATCH /api/users/me` — update current user's name, preferredLocale
2. User settings page `(app)/app/settings/page.tsx`:
   - Name field (editable)
   - Email field (read-only)
   - Language select: English / Italiano — on change, updates `preferredLocale` in DB + sets `NEXT_LOCALE` cookie + soft refresh
   - Auth provider info (Google or email)
   - "Change password" section (only if credentials provider) — future, show as disabled
3. The language change must immediately reflect in the UI without page reload (or with a minimal refresh)

**Verify**: Can change name. Can change language — UI switches immediately. Preference persists across sessions (cookie + DB).

**Commit**: `feat: implement user settings with language preference`

---

## Post-Phase 1 checklist
When all Phase 1 tasks are complete, verify:
- [ ] Monorepo runs: Next.js on :3000, FastAPI on :8000
- [ ] i18n works: browser detection, cookie persistence, Settings page selector, marketing footer selector
- [ ] All routes render placeholder pages with translated labels
- [ ] Auth works: register, login (email + Google), logout, session persistence
- [ ] Protected routes redirect correctly
- [ ] CRUD projects: create, list, edit, delete
- [ ] Admin panel: user list, role management, user projects view
- [ ] Prisma Studio shows all tables with correct schema
- [ ] All route translations work in both IT and EN

Then update this file:
- Set Phase 1 status to COMPLETE
- Set current phase to Phase 2
- Add Phase 2 atomic tasks (Landing page & preview flow)

### Task 1.10 — README.md
**Status**: DONE
**Goal**: Write the project README as the first commit of Phase 2, once the Phase 1 foundation is stable and fully working.

**Content**:
- Project description and tech stack overview
- Prerequisites (Node ≥20, Python ≥3.11, PostgreSQL with pgvector, Google OAuth credentials)
- Local setup step by step:
  1. Clone + `npm install`
  2. Copy `.env.example` → `.env` and fill in values
  3. `cd apps/web && npx prisma migrate dev`
  4. `npx prisma db seed` (creates local superadmin)
  5. `cd services/analyzer && python3 -m venv .venv && pip install -r requirements.txt`
  6. `npm run dev:web` (port 3000) + `uvicorn app.main:app` (port 8000)
- Monorepo structure diagram
- Link to CLAUDE.md for conventions and architecture decisions
- Link to `docs/` for specs and theory

**Commit**: `docs: add project README with setup instructions`

---

---

## Phase 2 — Landing page & preview flow (atomic tasks) — COMPLETE

---

### Task 2.1 — Google Analytics setup
**Status**: DONE
**Goal**: Integrate GA4 on the marketing site only.

**Steps**:
1. Add `NEXT_PUBLIC_GA_MEASUREMENT_ID` to `.env` and `.env.example`
2. Create `components/analytics/google-analytics.tsx` — loads `gtag.js` script, initializes GA4, exposes `sendGAEvent(name, params)` helper
3. Add component to `(marketing)/layout.tsx` only (never in app/admin layouts)
4. Create `lib/analytics.ts` with typed `sendGAEvent` function
5. Fire `page_view` automatically on route change (GA4 default with SPA config)

**Verify**: GA4 DebugView shows `page_view` when navigating between `/`, `/pricing`, `/about`. No events fire when navigating in `/app`.

**Commit**: `feat: setup Google Analytics 4 on marketing site`

---

### Task 2.2 — Landing page
**Status**: DONE
**Goal**: Build the full landing page with the analysis form.

**Steps**:
1. Replace placeholder `(marketing)/page.tsx` with a real hero section:
   - Headline + subheading (i18n)
   - Form: website URL, brand name, 3 target query fields (above the fold)
   - Primary CTA button: "Get your AI Score"
   - Brief "how it works" section below the fold (3 steps: analyze → score → improve)
2. Create `components/features/preview-form.tsx` (client component):
   - Validates inputs
   - `POST /api/preview/analyze` on submit
   - On success: `router.push('/preview/[id]')`
   - On error: show inline error message
   - GA events: `form_start` (first field touched), `analysis_requested` (submit)
3. Add all i18n keys to `messages/en.json` and `messages/it.json` under `landing` namespace
4. Marketing navbar already exists — verify Login/Register links work

**Verify**: Form submits, creates a `PreviewAnalysis` record in DB, redirects to `/preview/[id]`. GA events appear in DebugView.

**Commit**: `feat: build landing page with analysis form`

---

### Task 2.3 — Preview API routes
**Status**: DONE
**Goal**: Implement the three preview API endpoints.

**Steps**:
1. `POST /api/preview/analyze`:
   - Body: `{ websiteUrl, brandName, queryTargets: string[], locale? }`
   - Validate inputs (URL format, brandName not empty, 1–5 queries)
   - Capture `ipAddress` (from `x-forwarded-for` header), `userAgent`, `referrer` from request headers
   - Detect `locale` from cookie `NEXT_LOCALE` or `Accept-Language` if not in body
   - Create `PreviewAnalysis` record (status: `pending`)
   - Create `Job` record (type: `preview_analysis`, payload: `{ previewId }`)
   - Return `{ previewId }` — no auth required

2. `GET /api/preview/[id]`:
   - Find `PreviewAnalysis` by ID
   - If not found or expired (`expiresAt < now`): 404
   - Return: `{ id, status, websiteUrl, brandName, aiReadinessScore, fanoutCoverageScore, passageQualityScore, chunkabilityScore, entityCoherenceScore, crossPlatformScore, insights, contentsFound, createdAt, expiresAt }`
   - No auth required

3. `POST /api/preview/[id]/send-report`:
   - Body: `{ email }`
   - Validate email format
   - Update `PreviewAnalysis.reportEmail = email`
   - Create `Job` record (type: `send_preview_report`, payload: `{ previewId, email }`)
   - Return `{ success: true }`
   - No auth required

**Verify**: All three endpoints return correct responses. Curl `POST /api/preview/analyze` → creates DB records → `GET /api/preview/[id]` returns the preview.

**Commit**: `feat: implement preview API routes (analyze, status, send-report)`

---

### Task 2.4 — Python microservice — preview pipeline
**Status**: DONE
**Goal**: Implement the full micro-analysis pipeline in FastAPI.

**Steps**:
1. Update `services/analyzer/requirements.txt`:
   - `fastapi`, `uvicorn`, `httpx`, `anthropic`, `google-generativeai`, `voyageai`, `numpy`, `beautifulsoup4`, `python-dotenv`, `mailersend`
2. Create `services/analyzer/app/config.py` — loads env vars
3. Implement `POST /api/v1/preview-analyze` endpoint:
   - Input: `{ website_url, brand_name, query_targets, language }`
   - **Step 1** — Quick crawl via Brave Search API (`site:{domain}`, max 20 results)
   - **Step 2** — Fetch + chunk top 5–10 pages (BeautifulSoup, passage segmentation)
   - **Step 3** — Fan-out queries via Gemini 2.0 Flash (10 per target query, in `language`)
   - **Step 4** — Embed queries + passages via Voyage AI `voyage-3-large` (1024 dims); cosine similarity; coverage threshold 0.75
   - **Step 5** — Passage quality via Claude Sonnet (2 best passages per page, 5 criteria: self-containedness, claim clarity, info density, completeness, verifiability)
   - **Step 6** — Chunkability score (heuristic: paragraph length 134–167 words optimal, heading coverage, answer-first structure)
   - **Step 7** — Entity coherence (simplified: term consistency across pages)
   - **Step 8** — Cross-platform signal via Brave Search (search brand on LinkedIn, Medium, Substack, Reddit, YouTube)
   - **Step 9** — Composite AI Readiness Score (weighted average)
   - **Step 10** — Insight generation via Claude or Gemini (3–4 bullets, in `language`)
   - Return full result JSON
4. Create `services/analyzer/app/worker.py` — polls `jobs` table (type: `preview_analysis`), calls preview pipeline, updates `PreviewAnalysis` record with results (status: `completed`)
5. Keep pipeline under 60 seconds — parallelize where possible (asyncio)

**Verify**: `curl POST /api/v1/preview-analyze` with a real website returns all 6 scores + insights within 60s. Worker processes a job end-to-end.

**Commit**: `feat: implement Python preview analysis pipeline`

---

### Task 2.5 — Preview result page UI
**Status**: DONE
**Goal**: Build the `/preview/[id]` result page with score display, radar chart, insights, and CTAs.

**Steps**:
1. Replace placeholder `(marketing)/preview/[id]/page.tsx`:
   - Server component: load preview data on server (no client polling if status=completed)
   - If status = `pending` or `processing`: render `PreviewPolling` client component that polls `GET /api/preview/[id]` every 3s with a progress indicator
   - If status = `completed`: render full results
   - If status = `failed` or not found: show error state
2. Score display section:
   - Large central `aiReadinessScore` (e.g., "42/100")
   - Radar/spider chart with 5 sub-scores — use `recharts` (install)
   - Each sub-score row: name + value + `?` icon tooltip (opens `ScoreExplainer` popover)
3. `ScoreExplainer` component: popover with what-is, example, improve action (i18n)
4. Insights section: 3–4 AI-generated bullets
5. Blurred "locked" section (full content list + detailed recommendations — blurred overlay with register CTA)
6. Two CTA buttons:
   - "Get the report via email" → inline email input appears → `POST /api/preview/[id]/send-report` → confirmation message
   - "Sign up for full analysis" → `/register?preview=[id]`
7. All text i18n under `preview` namespace
8. GA events: `preview_viewed` on load, `report_requested` on email submit, `registration_started` on CTA click

**Verify**: Preview page shows scores and radar chart. Polling works (shows progress then results). Email CTA sends report job. Register CTA navigates correctly.

**Commit**: `feat: build preview result page with scores, radar chart, and CTAs`

---

### Task 2.6 — Email + PDF report
**Status**: DONE
**Goal**: Send a PDF report via MailerSend when user requests it.

**Steps**:
1. Install: `@react-email/components`, `@react-pdf/renderer` (or use `puppeteer` for PDF), `mailersend` in `apps/web`
2. Create `lib/email.ts` — MailerSend client wrapper with `sendEmail(to, subject, html, attachments?)` helper
3. Create `emails/preview-report.tsx` — React Email template:
   - Visiblee branding header
   - AI Readiness Score (prominent)
   - 5 sub-scores table
   - Insights section (3–4 bullets)
   - Register CTA button
   - Footer with legal links
   - Translatable (accepts locale, uses `messages/*.json`)
4. Create `lib/pdf.ts` — renders the report template to PDF buffer using `@react-pdf/renderer`
5. Create job worker in Next.js (or Python service): listens for `send_preview_report` jobs, generates PDF, calls MailerSend, updates `preview_analyses.reportSentAt`
6. Add env vars: `MAILERSEND_API_KEY`, `EMAIL_FROM` to `.env` and `.env.example`

**Verify**: Trigger email from preview page → email arrives with PDF attachment containing the correct scores and insights. Works in both IT and EN.

**Commit**: `feat: implement PDF report generation and MailerSend email delivery`

---

### Task 2.7 — Registration conversion from preview
**Status**: DONE
**Goal**: When a user registers after viewing a preview, automatically create their first project from preview data.

**Steps**:
1. Update register page to accept `?preview=[id]` query param:
   - Pre-fill email if `preview.reportEmail` is set
   - After registration, look up the preview and call conversion logic
2. Create server action `lib/actions/convert-preview.ts`:
   - Input: `userId`, `previewId`
   - Create `Project` from preview: `name = brandName`, `websiteUrl`, status `active`
   - Create `TargetQuery` records from preview's `queryTargets`
   - Update `PreviewAnalysis`: `userId`, `projectId`, `convertedAt = now()`
   - Create `Job` (type: `full_analysis`, payload: `{ projectId }`) — placeholder for Phase 3
   - Return `{ projectId }`
3. Update register flow in `lib/actions/auth.ts`: after user creation, check for `previewId` param, call `convertPreview`, redirect to `/app/projects/[id]/overview`
4. Show banner on project overview page if `?converted=true` query param is present: "We've imported your preview data. Full analysis is starting."
5. Add `projectId` to `PreviewAnalysis` in conversion

**Verify**: Register via `/register?preview=[id]` → project created → redirect to project overview → banner shown → preview linked to user in DB.

**Commit**: `feat: implement preview-to-project conversion on registration`

---

## Environment variables
```env
# Database (local)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/visiblee

# Auth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate-a-random-secret-here
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Python microservice
ANALYZER_API_URL=http://localhost:8000
ANALYZER_API_KEY=dev-internal-key

# LLM providers (not needed in Phase 1)
# ANTHROPIC_API_KEY=
# GOOGLE_AI_API_KEY=
# VOYAGE_API_KEY=

# Brave Search (not needed in Phase 1)
# BRAVE_SEARCH_API_KEY=

# Email (not needed in Phase 1)
# MAILERSEND_API_KEY=
# EMAIL_FROM=noreply@visiblee.ai

# Analytics (not needed in Phase 1)
# NEXT_PUBLIC_GA_MEASUREMENT_ID=
```

---

## Phase 3 — Content discovery & authenticated app (atomic tasks)

Complete in order. Each task = one commit. Verify before proceeding.

---

### Task 3.1 — Project overview page (real UI)
**Status**: TODO
**Goal**: Replace the overview placeholder with the real dashboard: AI Readiness Score, radar chart, score explainer popovers. Shows empty state if no snapshot exists yet.

**Steps**:
1. API route `GET /api/projects/[id]/snapshot/latest` — returns the most recent `ProjectScoreSnapshot` (or `null`)
2. Replace `(app)/app/projects/[id]/overview/page.tsx`:
   - If no snapshot: educational empty state explaining what will appear and why it matters
   - If snapshot exists: render `OverviewDashboard` client component
3. `OverviewDashboard` component:
   - Large central score: `aiReadinessScore` (e.g. `42 / 100`)
   - Radar chart with 5 sub-scores (reuse `ScoreRadarChart` from preview)
   - Sub-score rows: label + value + `?` icon that opens `ScoreExplainer` popover
4. `ScoreExplainer` popover: what-is, improve-tip — content from `scores.*.description` i18n keys
5. "Run analysis" button — for now just shows a toast "Analysis queued" (actual trigger in Task 3.5)

**Verify**: Empty state shows when no snapshot. With a seeded snapshot, scores and radar chart display correctly. Score explainer popovers open.

**Commit**: `feat: build project overview page with score dashboard and explainers`

---

### Task 3.2 — Python: full content discovery pipeline
**Status**: TODO
**Goal**: Crawl the domain via Brave Search, classify results with LLM into own/mention/verify groups, save to `contents` table.

**Steps**:
1. Create `services/analyzer/app/discovery.py`:
   - `discover_content(website_url, brand_name, language)` async function
   - Brave Search `site:{domain}` (up to 50 results) → "own content" candidates
   - Brave Search `"{brand_name}"` excluding domain (up to 20 results) → "mentions" candidates
   - Gemini 2.0 Flash classifies each result: `own` / `mention` / `irrelevant`
   - Platform detection: linkedin, medium, substack, reddit, youtube, news, other
   - Returns list of `{ url, title, snippet, platform, contentType, confidence }` objects
2. Add job type `discovery` to the worker — calls `discover_content`, saves to `contents` table with `isConfirmed = false`, completes job
3. `POST /api/v1/discover` endpoint (protected) for testing

**Verify**: Worker processes a `discovery` job and populates the `contents` table with correctly classified URLs.

**Commit**: `feat: implement full content discovery pipeline in Python`

---

### Task 3.3 — Python: content fetch and passage segmentation
**Status**: TODO
**Goal**: Fetch confirmed content URLs, extract clean text, segment into passages, save to DB.

**Steps**:
1. `services/analyzer/app/fetcher.py`:
   - `fetch_content(url)`: httpx fetch → BeautifulSoup clean text (strip nav/footer/ads) → title, word count
   - If fetch fails or word count < 50: mark content `fetch_failed`
2. `services/analyzer/app/segmenter.py`:
   - `segment_passages(text)`: split by paragraphs, filter 30–300 words, assign passageIndex/wordCount/heading
3. Job type `fetch_content` in worker: fetches one `Content` record, calls fetch + segment, saves `Passage` records, updates `Content.lastFetchedAt` + status → `fetched`

**Verify**: Worker processes a `fetch_content` job. `Content.rawText` populated. `Passage` records in DB.

**Commit**: `feat: implement content fetching and passage segmentation`

---

### Task 3.4 — Contents page UI
**Status**: TODO
**Goal**: Build `/contents` showing discovered content with confirm/discard actions and manual add.

**Steps**:
1. API routes:
   - `GET /api/projects/[id]/contents` — list with pagination, filter by status/platform/contentType
   - `PATCH /api/projects/[id]/contents/[cId]` — update `isConfirmed`
   - `POST /api/projects/[id]/contents` — manually add a URL
2. Replace `(app)/app/projects/[id]/contents/page.tsx`:
   - Three tabs: "Your content" / "Mentions" / "To verify"
   - Each row: platform badge, URL, title, word count, confirm/discard buttons
   - "Manually add URL" inline form
   - "Run discovery" button → creates a `discovery` job → toast
3. Platform badge component: icon + color per platform
4. i18n under `contents` namespace

**Verify**: List loads. Can confirm/discard. Tabs filter correctly. Can add URL manually.

**Commit**: `feat: build contents page with discovery results and confirm/discard actions`

---

### Task 3.5 — Full scoring engine (Python)
**Status**: TODO
**Goal**: Implement all 5 score components for a full project analysis (not sampled).

**Steps**:
1. `services/analyzer/app/scoring/fanout.py` — 20 fan-out queries per target via Gemini; embed via Voyage AI; cosine similarity vs passages; threshold 0.75; save `FanoutQuery` + `FanoutCoverageMap`
2. `services/analyzer/app/scoring/passage_quality.py` — Claude Sonnet evaluates each passage (5 criteria: self-containedness 25%, claim clarity 20%, info density 20%, completeness 20%, verifiability 15%); save `PassageScore`
3. `services/analyzer/app/scoring/chunkability.py` — heuristic: length (134–167 words optimal), heading coverage, no self-refs, schema presence, answer-first; weights 25/25/20/15/15
4. `services/analyzer/app/scoring/entity_coherence.py` — term consistency, semantic cohesion (avg cosine sim), co-occurrence, platform diversity; weights 30/25/20/25
5. `services/analyzer/app/scoring/cross_platform.py` — platform weight × presence × freshness decay (365-day)
6. `services/analyzer/app/scoring/composite.py` — weighted average → `ai_readiness_score`
7. `services/analyzer/app/full_pipeline.py` — orchestrates all scorers, saves `ProjectScoreSnapshot` + scores
8. Job type `full_analysis` in worker (already queued by `convert-preview`)

**Verify**: Worker processes `full_analysis` job. `ProjectScoreSnapshot` created with all 6 scores. `PassageScore` records with sub-criteria values.

**Commit**: `feat: implement full 5-score analysis engine in Python`

---

### Task 3.6 — Content detail page
**Status**: TODO
**Goal**: `/contents/[cId]` showing all passages with individual scores and Claude reasoning.

**Steps**:
1. API route `GET /api/projects/[id]/contents/[cId]` — content + passages + latest passage scores
2. Replace `(app)/app/projects/[id]/contents/[cId]/page.tsx`:
   - Content header: URL, title, platform badge, word count, last fetched
   - Passage list: `passageText` truncated, overall score, expandable with 5 sub-criteria + `llmReasoning`
   - Sub-criteria: label + score bar + tooltip
3. i18n under `contentDetail` namespace (keys: `selfContainedness`, `claimClarity`, `informationDensity`, `completeness`, `verifiability`)

**Verify**: Page loads with passages and scores. Sub-criteria expand with reasoning text.

**Commit**: `feat: build content detail page with passage scores`

---

### Task 3.7 — Opportunity Map page
**Status**: TODO
**Goal**: Visual map of fan-out query coverage — covered/partial/gap per target query.

**Steps**:
1. API route `GET /api/projects/[id]/opportunities` — fan-out queries grouped by target query, each with `isCovered` + `similarityScore`
2. Replace `(app)/app/projects/[id]/opportunities/page.tsx`:
   - Per target query: expandable section with all fan-out queries
   - Green chip (≥ 0.75), yellow (0.5–0.74), red (< 0.5)
   - Summary: X covered / Y total
3. i18n under `opportunities` namespace

**Verify**: Opportunity map loads with fan-out queries color-coded by coverage.

**Commit**: `feat: build opportunity map page with fan-out coverage visualization`

---

### Task 3.8 — Recommendations and Optimization page
**Status**: TODO
**Goal**: LLM-generated prioritized recommendations and optimization page.

**Steps**:
1. `services/analyzer/app/recommendations.py` — Claude Sonnet generates 5–10 recommendations at end of `full_analysis` job (title, description, suggestedAction, priority, effort, targetScore) in user's `preferredLocale`; save to `Recommendation` table
2. API routes:
   - `GET /api/projects/[id]/recommendations` — sorted by priority + estimatedImpact
   - `PATCH /api/projects/[id]/recommendations/[rId]` — update status
3. Replace `(app)/app/projects/[id]/optimization/page.tsx`:
   - High / Medium / Low priority sections
   - Each card: type badge, title, description, effort chip, status actions
4. i18n under `optimization` namespace

**Verify**: After `full_analysis`, recommendations appear. Can change status.

**Commit**: `feat: implement recommendations generation and optimization page`

---

### Task 3.9 — Notifications system
**Status**: TODO
**Goal**: In-app notification center with unread count badge.

**Steps**:
1. API routes: `GET /api/notifications`, `PATCH /api/notifications/[id]`, `POST /api/notifications/mark-all-read`
2. Create notifications on job completion: `analysis_complete`, `score_change` (if score delta > 5 pts vs previous snapshot)
3. App navbar: bell icon with unread badge
4. Notification panel (Sheet): slides in from right, marks as read on click
5. Replace `(app)/app/notifications/page.tsx` with full history list
6. i18n under `notifications` namespace

**Verify**: After `full_analysis` completes, notification appears. Badge shows. Panel marks read.

**Commit**: `feat: implement in-app notification system`

---

### Task 3.10 — Onboarding wizard
**Status**: TODO
**Goal**: 4-step illustrated tour shown on first project view.

**Steps**:
1. `components/onboarding/onboarding-wizard.tsx` — dialog with 4 steps:
   - Step 1: How AI decides who to cite
   - Step 2: Your AI Readiness Score (5 dimensions)
   - Step 3: Content discovery (why confirming matters)
   - Step 4: Your roadmap (recommendations + weekly tracking)
2. Show on first visit (track with `localStorage` key `onboarding_completed_{projectId}`)
3. "Skip" and "Next / Let's go" buttons; celebration on final step
4. i18n under `onboarding` namespace

**Verify**: Wizard appears on first project visit, not on subsequent visits. Works in both languages.

**Commit**: `feat: implement onboarding wizard for new projects`

---

## Notes for Claude Code
- Always read the project knowledge documents before implementing features. They contain the exact DB schema, API design, UX flows, and scoring logic.
- The `visiblee-specs.md` file is the technical source of truth for all implementation details.
- When creating UI components, use shadcn/ui components and Tailwind CSS. No custom CSS unless absolutely necessary.
- All user-facing strings must use i18n translation keys, never hardcoded text.
- Empty states should be educational: explain what will appear and why it's useful (see specs section 4.6).
- Score names in code/DB/API are always technical (`fanout_coverage_score`). User-friendly names (`Query Reach`) only in translation files.