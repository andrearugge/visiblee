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
│       │   ├── ui/                 # shadcn/ui + shared primitives (StepLoader, etc.)
│       │   ├── layout/            # Shells, Sidebar, Navbar
│       │   ├── analytics/         # GA component
│       │   ├── onboarding/        # Wizard, explainers, empty states
│       │   └── features/          # Feature-specific components
│       ├── hooks/                  # Shared React hooks (useJobPolling, etc.)
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

### UX and component conventions
- **Consistency first**: if a loader, polling flow, or UI pattern appears more than once, extract it as a shared primitive.
- **`StepLoader`** (`components/ui/step-loader.tsx`): use for ALL background-job loading states (discovery, analysis, any future job). Props: `title`, `subtitle`, `steps[]`, `pollingText?`, `skeleton` (`score-rows` | `content-rows`).
- **`useJobPolling`** (`hooks/use-job-polling.ts`): use for ALL polling loops. Defaults to `router.refresh()` on done; accepts `onDone` override for custom behaviour (e.g. show a banner instead of refreshing).
- **Router Cache bust**: always call `router.refresh()` immediately after creating a job, so navigating away and back preserves the loading state.
- At the end of each phase, compact CLAUDE.md: replace completed task bodies with one-line summaries.

### Development principles
- **Atomic tasks**: each task is self-contained and completable in isolation.
- **Verify before proceeding**: each step must be tested and working before starting the next.
- **Update this file**: after completing each task, update the status below.

---

## Current state

**Phase**: 3 — Content discovery & authenticated app
**Status**: IN PROGRESS
**Last completed**: Tasks 3.1–3.5 (overview dashboard, discovery pipeline, content UI, scoring engine)

---

## Phase 1 — Foundation — COMPLETE

| Task | Summary |
|---|---|
| 1.1 | Monorepo scaffold: Next.js + FastAPI placeholder |
| 1.2 | shadcn/ui with New York style + Zinc base |
| 1.3 | next-intl i18n: EN/IT, browser detection, no URL prefix |
| 1.4 | Route groups + layouts: marketing, auth, app, admin |
| 1.5 | Prisma + full DB schema (all tables including pgvector) |
| 1.6 | Auth.js v5: Google OAuth + credentials, JWT sessions |
| 1.7 | CRUD projects: dashboard, new project form, settings, delete |
| 1.8 | Admin panel: user list, role management, superadmin seed |
| 1.9 | User settings: name, language preference, locale cookie |
| 1.10 | README with setup instructions |

---

## Phase 2 — Landing page & preview flow — COMPLETE

| Task | Summary |
|---|---|
| 2.1 | GA4 on marketing layout only |
| 2.2 | Landing page with hero form + how-it-works section |
| 2.3 | Preview API routes: POST analyze, GET status, POST send-report |
| 2.4 | Python preview pipeline: crawl → chunk → fanout → embed → score → insights |
| 2.5 | Preview result page: score display, radar chart, insights, locked CTA, email report |
| 2.6 | PDF report generation + MailerSend email delivery |
| 2.7 | Preview → project conversion on registration |

---

## Phase 3 — Content discovery & authenticated app

### Tasks 3.1–3.5 — DONE

| Task | Summary |
|---|---|
| 3.1 | Overview page: score dashboard + radar chart + score explainers + empty states |
| 3.2 | Python discovery pipeline: 8 parallel Brave searches + Gemini classification |
| 3.3 | Content fetch + passage segmentation (fetcher.py, segmenter.py); auto-fetch in full pipeline |
| 3.4 | Contents page: tabs, confirm/discard, bulk selection, discovery loader, results-ready banner |
| 3.5 | Full scoring engine: fanout coverage, passage quality, chunkability, entity coherence, cross-platform, composite |

**Key shared primitives built:**
- `components/ui/step-loader.tsx` — `StepLoader` component (used by overview + contents)
- `hooks/use-job-polling.ts` — `useJobPolling` hook (used by overview + contents)

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

## Environment variables
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/visiblee
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate-a-random-secret-here
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
ANALYZER_API_URL=http://localhost:8000
ANALYZER_API_KEY=dev-internal-key
ANTHROPIC_API_KEY=
GOOGLE_AI_API_KEY=
VOYAGE_API_KEY=
BRAVE_SEARCH_API_KEY=
MAILERSEND_API_KEY=
EMAIL_FROM=noreply@visiblee.ai
NEXT_PUBLIC_GA_MEASUREMENT_ID=
```

## Notes for Claude Code
- Always read the project knowledge documents before implementing features.
- Use shadcn/ui + Tailwind. No custom CSS unless absolutely necessary.
- All user-facing strings must use i18n keys, never hardcoded text.
- Empty states should be educational (see specs section 4.6).
- Score names in code/DB/API are always technical. User-friendly names only in translation files.
- Use `StepLoader` for any background-job loading state. Use `useJobPolling` for any polling loop.
- Call `router.refresh()` after job creation to bust the Next.js Router Cache.
