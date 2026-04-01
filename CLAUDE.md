# CLAUDE.md — Visiblee

## What is this project

Visiblee is a SaaS that helps brands, agencies, and professionals improve their visibility in AI-powered search (Google AI Mode, AI Overviews, Gemini). It analyzes indexed content, builds an "AI Readiness" profile based on Google patents and empirical studies, and guides users to optimize for AI citation.

The product is live as MVP. ICP: SEO agencies, B2B brands, GEO consultants.

---

## Stack (exact versions matter)

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router) + React 19 |
| UI | shadcn/ui (New York style, Zinc base) + Tailwind CSS v4 |
| i18n | next-intl v4, EN + IT, no URL prefix, cookie `NEXT_LOCALE` |
| Auth | Auth.js v5, Google OAuth + credentials, JWT sessions (stateless) |
| Database | PostgreSQL 16 + pgvector (HNSW) |
| ORM | Prisma v7 with `@prisma/adapter-pg` (driver adapter pattern) |
| Python service | FastAPI on Hetzner (analysis, scoring, embedding, GSC sync) |
| Embeddings | Voyage AI `voyage-3` (dim 1024) |
| Fan-out | Gemini Flash (`gemini-2.0-flash`) |
| Citation check | Gemini API + Google Search Grounding |
| Discovery | Brave Search API (8 parallel searches) + Gemini classification |
| GSC | Google Search Console API (`webmasters.readonly`), separate OAuth |
| Email | MailerSend (transactional + PDF report) |
| Analytics | GA4, marketing routes only |
| Deploy | Vercel (frontend) + Hetzner/Ploi (2 servers: DB + Python) |

---

## Conventions

### Code style
- **Database**: snake_case (tables and columns). Technical names only.
- **TypeScript**: camelCase variables, PascalCase types/components.
- **Python**: snake_case everything, PascalCase classes.
- **API routes**: kebab-case URLs.
- **Files**: kebab-case for files, PascalCase for React components.
- **i18n keys**: camelCase with dot notation (e.g. `scores.queryReach.description`).

### Score naming
Technical names in code/DB/API. User-friendly names ONLY in i18n translation files:

| Code name | UI name | Weight |
|---|---|---|
| `ai_readiness_score` | AI Readiness Score | composite |
| `fanout_coverage_score` | Query Reach | 30% |
| `citation_power_score` | Citation Power | 25% |
| `entity_authority_score` | Brand Authority | 20% |
| `extractability_score` | Extractability | 15% |
| `source_authority_score` | Source Authority | 10% |

### Git
- **Main branches**: `main` (production), `dev` (integration)
- **Feature branches**: create from `dev`, named `feature/v2-fase-N` (e.g. `feature/v2-fase-1`)
- **Workflow per fase**:
  1. Checkout `dev` e pull
  2. Crea branch `feature/phase-name`
  3. Lavora sulla fase — tutti i task della fase vanno su questo branch
  4. Al completamento: merge su `dev` (squash o merge commit, a discrezione)
  5. Nuova fase: ripeti da step 1
- **Fix/refactor durante una fase**: se il fix è dentro la fase corrente, resta nel branch fase. Se è trasversale, usa `fix/name` da `dev`.
- Commits: conventional (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`)
- One commit = one logical unit of work. Never multi-feature commits.
- At the end of each phase, compact CLAUDE.md: replace completed task bodies with one-line summaries.

### i18n rules
- No language prefix in URLs. Ever. Routes always in English.
- Language: `Accept-Language` → cookie `NEXT_LOCALE` → fallback `en`.
- Language selector: footer (marketing), Settings page (app). Nowhere else.
- AI-generated content uses `language` parameter in LLM prompts.
- All user-facing strings via i18n keys. Zero hardcoded text in TSX.

---

## Shared primitives (mandatory)

These exist and must be reused. Do not create alternatives.

- **`StepLoader`** (`components/ui/step-loader.tsx`): use for ALL background-job loading states. Props: `title`, `subtitle`, `steps[]`, `pollingText?`, `skeleton` (`score-rows` | `content-rows`).
- **`useJobPolling`** (`hooks/use-job-polling.ts`): use for ALL polling loops. Uses `useRef` internally — no stale closures. Accepts `onDone` override. Default: `router.refresh()`.
- **`SearchableSelect`** (`components/ui/searchable-select.tsx`): combobox with live filter, zero extra deps. Use for any dropdown with >10 options.
- **`useFormatNumber`** (`hooks/use-format-number.ts`): locale-aware number formatting (IT: 1.234,5 — EN: 1,234.5).
- **`lib/crypto.ts`** + **`app/crypto_utils.py`**: AES-256-GCM encrypt/decrypt for OAuth tokens. Cross-compatible format: `<ivHex>:<authTagHex>:<ciphertextHex>`. Use for any sensitive token stored in DB.
- **Router cache bust**: always call `router.refresh()` immediately after creating a job.

---

## Non-negotiable constraints

These are documented in `docs/architectural-decisions.md` (AD-01 through AD-15). Do not propose alternatives without reading the ADR first.

- **Scoring is heuristic, zero LLM** (AD-02). All 5 sub-scores are deterministic. No LLM in the scoring loop. Ever.
- **Intent classification is heuristic** (AD-15). Regex patterns IT+EN. No LLM in `gsc_sync` or `intent_engine`.
- **Citation check only via Gemini Grounding** (AD-03). Only official API for structured Google citations.
- **No scraping ChatGPT/Perplexity**. ToS violation.
- **Python pipeline on separate FastAPI** (AD-01). Long computation (3-8 min) incompatible with Vercel Functions.
- **Job queue via DB polling** (AD-09). `useJobPolling` + `router.refresh()`. No WebSocket, no SSE.
- **No URL prefix for i18n** (AD-07). Routes always English, language from cookie/header.
- **OAuth GSC separate from login** (AD-13). Different scope, lifecycle, storage. Never reuse Auth.js Google token for GSC.
- **OAuth tokens encrypted in DB** (AD-14). AES-256-GCM via shared crypto utilities.
- **Voyage AI for all embeddings** (AD-04). Do not mix providers.
- **Max 15 target queries per project** (AD-11). 5 free / 15 pro.

---

## Architecture: where to find things

### Reference documents

| Document | When to consult |
|---|---|
| `docs/product-state.md` | Before proposing anything — check what already exists |
| `docs/architectural-decisions.md` | Before any architectural change — 15 ADRs with rationale |
| `docs/v1-learnings.md` | Before repeating past mistakes — what worked, what didn't |
| `docs/scoring-methodology.md` | For scoring logic changes — algorithms, patents, literature |
| `docs/commercial-strategy.md` | For business impact assessment — ICP, pricing, roadmap |
| `docs/user-guide.md` | For understanding UX flows |
| `docs/_features/gsc-integration-architecture.md` | For GSC feature evolution — complete spec |

### Route groups

```
(marketing)/     → landing, preview, GA4
(auth)/          → login, register
(app)/           → authenticated area (no GA4)
(admin)/         → superadmin panel
api/             → Next.js API routes
```

### Key architectural patterns

**Job flow**: Next.js API route creates a row in `jobs` table → `router.refresh()` → frontend polls via `useJobPolling` showing `StepLoader` → Python worker picks up job, executes pipeline, updates status → frontend detects completion, calls `router.refresh()`.

**Job types**: `full_analysis`, `discovery`, `citation_check`, `citation_check_enriched`, `competitor_analysis`, `gsc_sync`, `preview_analysis`.

**GSC OAuth flow**: separate from Auth.js login. Tokens in `gsc_connections` table, encrypted with AES-256-GCM. Refresh handled independently by both TS (`lib/crypto.ts`) and Python (`crypto_utils.py`). Feature flag: `NEXT_PUBLIC_GSC_ENABLED`.

**Scoring pipeline** (Python): discovery → fetch → segment → fan-out → embed → cosine similarity → heuristic scoring → composite score → snapshot. All deterministic, ~$0.002 fan-out + ~$0.006 embedding per analysis.

**Citation pipeline** (Python): Gemini Grounding per target query → extract `grounding_supports` → map cited sources → detect user/competitor → optionally run enriched variants per intent profile.

---

## Current state: what exists and works

### Implemented features
- Landing page with preview analysis (crawl → score → insights → PDF report → email)
- Preview → project conversion on registration
- Project CRUD with `targetLanguage` + `targetCountry`
- Content discovery (Brave + Gemini classification) with confirm/discard
- Full scoring engine v2: 5 heuristic sub-scores + composite AI Readiness Score
- Score history chart with toggle per sub-score
- Content detail with per-passage scores (6 sub-criteria)
- Query management (add/remove, limit 15, bulk textarea)
- Citation simulation with trend tracking (4-week dots), expandable sources, segment quotes
- Opportunity Map with coverage tiers (excellent/good/weak/none)
- Competitor monitoring: manual add + auto-detection from citations + gap comparison
- Optimization recommendations (LLM-generated, priority/status management)
- GSC integration: OAuth connect, property selection, sync, intent classification, audience profiles, query suggestions, citation variants per profile
- Notifications (bell + sheet + history)
- Onboarding wizard (4-step, re-openable)
- Admin panel (user list, roles, superadmin seed)
- i18n complete EN + IT

### Known limitations (accepted for now)

- **No billing/plans**: plan rules enforced in code, no real payment system.
- **No scheduled jobs**: citation checks and GSC sync are manual. Weekly automatic is aspirational.
- **No multi-user per project**: single owner only.
- **No rate limiting**: Python microservice has no per-user rate limiting.
- **No export CSV**: in commercial roadmap, not implemented.
- **Google-only citation check**: no ChatGPT/Perplexity equivalent APIs exist.
- **GSC behind feature flag**: `NEXT_PUBLIC_GSC_ENABLED=true` required.

### Technical debt (known, not yet addressed)

- `rawHtml` stored in DB per content — needs external storage (S3/R2) before scaling users.
- `Job` model has no priority queue — FIFO only, fine for current volume.
- `Competitor` schema lacks sub-scores — only `avgPassageScore`, gap report needs granularity.
- `llmReasoning` in `PassageScore` is free text — not structured, hard to aggregate.
- No `Plan` model in DB — needed before activating billing.
- Job queue will need Redis/BullMQ when scheduled job volume grows significantly (Phase A implements scheduling via DB polling, adequate for current scale).

---

## v2 Implementation Status

### Phase 0 — Infrastructure & Staging (`feature/v2-fase-0`)

| Task | Status | Notes |
|---|---|---|
| 0.1 — Staging DB config | ✅ Done | `.env.staging.example` + README Staging section |
| 0.2 — Vercel staging docs | ✅ Done | README Staging section espansa con step-by-step Vercel |
| 0.3 — Worker/FastAPI separation | ✅ Done | `run_worker.py` standalone, lifespan rimosso da FastAPI |
| 0.4 — Scheduler placeholder | ✅ Done | `app/scheduler.py` — connette al DB, logga, esce |
| 0.5 — `docs/staging-setup.md` | ✅ Done | DNS, Hetzner, OAuth, Ploi, Vercel, smoke test checklist |
| 0.6 — Smoke test checklist | ✅ Done | In `docs/staging-setup.md` §6, /health aggiornato con check DB |

### Phase A — Fondamenta del loop continuo (`feature/v2-fase-a`)

| Task | Status | Notes |
|---|---|---|
| A.1 — `scheduledAt` su Job | ✅ Done | Campo `DateTime?` + migration SQL + `claim_job()` aggiornato |
| A.2 — Scheduler citation daily | ✅ Done | `create_daily_citation_jobs()` con limiti piano e anti-duplicato |
| A.3 — Worker job schedulati | ✅ Done | `scheduled_citation_daily/burst` → `process_citation_check_enriched_job` |
| A.4 — Booster mode | ✅ Done | Dopo `full_analysis`: 3/giorno × 7 giorni di burst job per query |
| A.5 — Scheduler GSC + analysis | ✅ Done | GSC sync domenicale + full analysis giorno 1 del mese |
| A.6 — Endpoint citation-stats | ✅ Done | `GET /api/projects/[id]/citation-stats?queryId=` — Beta(α,β) bayesiano |
| A.7 — UI citation rate bar | ✅ Done | `CitationRateBar` con banda confidenza, trend, label in `CitationCard` |

> ⚠️ **Azione manuale pendente**: applicare migration `scheduledAt` sul DB con superuser. Vedi `docs/_features/v2-azioni-manuali.md`.

### Phase B — Query-centric navigation (`feature/v2-fase-b`)

| Task | Status | Notes |
|---|---|---|
| B.1 — `targetQueryId` su Recommendation | ✅ Done | Campo nullable + FK + index + migration SQL |
| B.2 — `CompetitorQueryAppearance` | ✅ Done | Tabella con FK a Competitor/TargetQuery/CitationCheck + migration SQL |
| B.3 — Query route layout + sub-nav | ✅ Done | `layout.tsx` con ownership check + `QuerySubNav` a 4 tab |
| B.4 — Coverage sub-page | ✅ Done | `OpportunityMapClient` filtrato su `targetQueryId` |
| B.5 — Citations sub-page | ✅ Done | `QueryCitationsClient` con citazione, rate bar, run-check button |
| B.6 — Competitors sub-page | ✅ Done | `CompetitorQueryAppearance` aggregato per competitor |
| B.7 — Recommendations sub-page | ✅ Done | `OptimizationClient` filtrato per `targetQueryId` |
| B.8 — Overview aggregator | ✅ Done | Top competitor widget + citation gaps widget |

> ⚠️ **Azioni manuali pendenti** (B.1 + B.2): vedi `docs/_features/v2-azioni-manuali.md`.

### Phase C — Miglioramento setup (`feature/v2-fase-c`)

| Task | Status | Notes |
|---|---|---|
| C.1 — Sitemap Import | ✅ Done | Python `sitemap_import.py` + job type `sitemap_import` + UI button + GET polling endpoint |
| C.2 — Confidence badges | ✅ Done | `detectedLanguage` in schema + badge alta/media/bassa + filtro bassa confidence + lang mismatch badge |
| C.3 — GSC nell'onboarding | ✅ Done | Step 0 opzionale in `SetupChecklist` + gscEnabled flag + overview page aggiornata |
| C.4 — Setup banner pervasivo | ✅ Done | `SetupBanner` nel `ProjectLayout` — progress N/M + link Overview + auto-dismiss |

> ⚠️ **Azione manuale pendente** (C.2): migration `detectedLanguage` su DB produzione/staging.

### Phase D — GEO Expert (`feature/v2-fase-d`)

| Task | Status | Notes |
|---|---|---|
| D.1 — Modelli Prisma | ✅ Done | `ExpertConversation` + `ExpertMessage` + migration SQL |
| D.2 — API conversations + messages | ✅ Done | POST/GET conversations + POST/GET messages — Gemini Flash, max 30 msg, limite 50 conv free |
| D.3 — UI GEO Expert | ✅ Done | Lista conversazioni + chat view + `ExpertChat` client + link sidebar |
| D.4 — CTA "Ottimizza con GEO Expert" | ✅ Done | Pulsante nelle query recommendations con `contextPayload` pre-caricato → redirect chat |

> ⚠️ **Azione manuale pendente** (D.1): migration `expert_conversations` + `expert_messages` su DB. Vedi `docs/_features/v2-azioni-manuali.md`.
> ⚠️ **Variabile env richiesta**: `GOOGLE_AI_API_KEY` deve essere presente in Vercel (già usata nel Python service).

### Phase E — Personas manuali (`feature/v2-fase-e`)

| Task | Status | Notes |
|---|---|---|
| E.1 — Campi Prisma IntentProfile | ✅ Done | `source` (default `'gsc'`), `manualDescription`, `manualSampleQueries` + migration SQL + Python gsc_sync aggiornato (WHERE source='gsc') |
| E.2 — UI form persona manuale | ✅ Done | Form 3 campi (nome/descrizione/query) in sezione Audience, badge "Manual" viola, pulsante delete, visibile in tutti gli stati (anche no-GSC) |
| E.3 — API intent-profiles | ✅ Done | `POST /api/projects/[id]/intent-profiles` (crea + genera contextPrompt con Gemini Flash) + `DELETE /api/projects/[id]/intent-profiles/[profileId]` (solo source='manual') |

> ⚠️ **Azione manuale pendente** (E.1): migration `source`/`manualDescription`/`manualSampleQueries` su DB produzione/staging. Vedi `docs/_features/v2-azioni-manuali.md`.

---

## Notes for Claude Code

- Always read `docs/` reference documents before implementing features.
- Use shadcn/ui + Tailwind. No custom CSS unless absolutely necessary.
- Empty states should be educational (explain value, guide next action).
- Use `StepLoader` for any background-job loading state. Use `useJobPolling` for any polling loop.
- Call `router.refresh()` after job creation to bust the Next.js Router Cache.
- Components tracking job completion must query job status, not compare timestamps (anti-pattern causing race conditions).
- Prisma v7 uses driver adapter pattern — `PrismaPg` with `connectionString` via `prisma.config.ts`. Client output at `lib/generated/prisma`.
- Environment: check `.env.example` for required variables. GSC needs `GSC_CLIENT_ID`, `GSC_CLIENT_SECRET`, `GSC_TOKEN_ENCRYPTION_KEY`, `NEXT_PUBLIC_GSC_ENABLED`.