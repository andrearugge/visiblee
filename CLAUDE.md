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

**Phase**: 1 — Foundation
**Status**: IN PROGRESS
**Last completed task**: Task 1.4 — Route groups and layouts

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
**Status**: TODO
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
**Status**: TODO
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
**Status**: TODO
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
**Status**: TODO
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
**Status**: TODO  
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
**Status**: TODO
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

## Notes for Claude Code
- Always read the project knowledge documents before implementing features. They contain the exact DB schema, API design, UX flows, and scoring logic.
- The `visiblee-specs.md` file is the technical source of truth for all implementation details.
- When creating UI components, use shadcn/ui components and Tailwind CSS. No custom CSS unless absolutely necessary.
- All user-facing strings must use i18n translation keys, never hardcoded text.
- Empty states should be educational: explain what will appear and why it's useful (see specs section 4.6).
- Score names in code/DB/API are always technical (`fanout_coverage_score`). User-friendly names (`Query Reach`) only in translation files.