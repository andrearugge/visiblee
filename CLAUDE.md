# CLAUDE.md — Visiblee

## Phase 4 — Scoring Engine v2 + Discovery v2 — COMPLETE

Reference: `/docs/visiblee-methodology-v2.md` (algorithmic rationale) and `/docs/refactoring-plan-v2.md` (task log).

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
| Code name | UI name | Weight |
|---|---|---|
| `ai_readiness_score` | AI Readiness Score | composite |
| `fanout_coverage_score` | Query Reach | 30% |
| `citation_power_score` | Citation Power | 25% |
| `entity_authority_score` | Brand Authority | 20% |
| `extractability_score` | Extractability | 15% |
| `source_authority_score` | Source Authority | 10% |

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

**Phase**: 5 — UI Features + Market Targeting — **COMPLETE**
**Status**: COMPLETE ✅

---

## Phase 5 — UI Features + Market Targeting — COMPLETE

| Task | Summary |
|---|---|
| 5.1 | Queries management page: add/remove queries (limit 15), run analysis, i18n `queries` namespace |
| 5.2 | Citation simulation UI: `TrendDots`, expandable `CitationCard` per query, sources list, segment quote, Gemini search queries toggle |
| 5.3 | Citation simulation backend: enriched `citation_check.py` — grounding_supports → `supportedText`, `responseText`, `userCitedPosition`, `userCitedSegment`, `isCompetitor`; DELETE-before-INSERT |
| 5.4 | Content detail page verified: fixed missing `answerFirst` in DB select |
| 5.5 | Score history chart: Recharts LineChart in overview, toggle per sub-score, min 2 snapshots |
| 5.6 | Competitor monitoring: add/delete competitors, trigger `competitor_analysis` job, comparison score bars |
| 5.7 | Opportunity Map UX: header, stat card, legend, gap row highlights, sort toggle, fixed "11 11 gap" bug |
| 5.8 | Overview empty state: `SetupChecklist` with localStorage dismiss, multi-line textarea for queries, `min-h-[calc(100vh-3.5rem)]` skeleton |
| 5.9 | Target language + country on Project: `targetLanguage` (ISO 639-1) + `targetCountry` (ISO 3166-1); `SearchableSelect` component; market-aware fanout, discovery (Brave `country`+`search_lang`), citation check (Gemini system prompt) |
| 5.10 | Settings page: edit targetLanguage + targetCountry on existing projects |

**Key additions:**
- `components/ui/searchable-select.tsx` — lightweight combobox with live filter, no extra deps
- `app/api/projects/[id]/citations/route.ts` — GET citations with 4-week trend bucketing

---

## Phase 4 — Scoring Engine v2 + Discovery v2

Full refactoring of the scoring engine and discovery pipeline. Reference: `/docs/refactoring-plan-v2.md` and `/docs/visiblee-methodology-v2.md`.

**Blocco 0 — Discovery:**

| Task | Status | Summary |
|---|---|---|
| 4.0 | ✅ | discovery.py: intitle + backlink + sector keywords + brand variations + Gemini Grounding; worker passes target_queries |

**Blocco A — Fondamenta:**

| Task | Status | Summary |
|---|---|---|
| 4.1 | ✅ | CLAUDE.md updated with v2 score names, Phase 4 task table, Task 4.0 added |
| 4.2 | ✅ | Prisma schema migration: rename score columns + new fields (CitationCheck, ContentVersion) |
| 4.3 | ✅ | config.py: add coverage thresholds, freshness multipliers, free tier limits |
| 4.4 | ✅ | fetcher.py: preserve raw HTML, extract JSON-LD schema markup, robots.txt check |
| 4.5 | ✅ | segmenter.py: add relative_position, entity_density, has_statistics, has_source_citation, is_answer_first |

**Blocco B — Nuovo scoring engine:**

| Task | Status | Summary |
|---|---|---|
| 4.6 | ✅ | scoring.py: fanout cleanup + recent category + current year injection |
| 4.7 | ✅ | embeddings.py: 4-tier coverage (excellent/good/weak/none) replacing binary threshold |
| 4.8 | ✅ | scoring.py: score_citation_power (fully heuristic, zero LLM calls) |
| 4.9 | ✅ | scoring.py: score_entity_authority, score_extractability, score_source_authority, freshness multiplier |
| 4.10 | ✅ | full_pipeline.py: integrate all new scores + freshness multiplier + content versioning |

**Blocco C — Citation verification + UI:**

| Task | Status | Summary |
|---|---|---|
| 4.11 | ✅ | citation_check.py: Gemini Grounding API for real citation verification |
| 4.12 | ✅ | competitor_analysis.py: auto-analyze competitor pages found in citation checks |
| 4.13 | ✅ | pipeline.py (preview): update to new score names and heuristic scoring |
| 4.14 | ✅ | i18n + UI: update all score name references in TypeScript/TSX — zero TS errors |
| 4.15 | ✅ | CLAUDE.md: Phase 4 complete |

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

## Phase 3 — Content discovery & authenticated app — COMPLETE

| Task | Summary |
|---|---|
| 3.1 | Overview page: score dashboard + radar chart + score explainers + empty states |
| 3.2 | Python discovery pipeline: 8 parallel Brave searches + Gemini classification |
| 3.3 | Content fetch + passage segmentation (fetcher.py, segmenter.py); auto-fetch in full pipeline |
| 3.4 | Contents page: tabs, confirm/discard, bulk selection, discovery loader, results-ready banner |
| 3.5 | Full scoring engine: fanout coverage, passage quality, chunkability, entity coherence, cross-platform, composite |
| 3.6 | Content detail page: passages + per-passage scores (5 sub-criteria) + reasoning, i18n `contentDetail` |
| 3.7 | Opportunity Map: per-target fanout queries saved to DB, coverage chips (green/amber/red), i18n `opportunities` |
| 3.8 | Recommendations + Optimization page: LLM-generated recs via Claude/Gemini, priority sections, status controls |
| 3.9 | Notifications: bell badge + Sheet panel + history page + Python worker creates analysis_complete/score_change |
| 3.10 | Onboarding wizard: 4-step dialog on first project visit, re-openable from sidebar "How it works" button |

**Key shared primitives:**
- `components/ui/step-loader.tsx` — `StepLoader` for all background-job loading states
- `hooks/use-job-polling.ts` — `useJobPolling` for all polling loops
- `components/features/notification-bell.tsx` — notification bell with Sheet panel
- `components/onboarding/onboarding-wizard.tsx` — 4-step wizard, event-driven re-open

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
