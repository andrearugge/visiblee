# Changelog

## [Unreleased]

### Phase B — Navigazione query-centrica

#### B.1 — `targetQueryId` su Recommendation
- Campo nullable `targetQueryId` aggiunto a `Recommendation` con FK → `TargetQuery` e index
- `generate_recommendations()` in Python ora propaga `target_query_id` opzionale
- ⚠️ Migration da applicare manualmente (vedi `docs/_features/v2-azioni-manuali.md`)

#### B.2 — `CompetitorQueryAppearance`
- Nuova tabella `competitor_query_appearances`: traccia ogni competitor citato per ogni query in ogni citation check
- `save_competitor_appearances()` in `citation_check.py`: upsert competitor + insert appearance dopo ogni check
- ⚠️ Migration da applicare manualmente (vedi `docs/_features/v2-azioni-manuali.md`)

#### B.3 — Layout query + sub-nav
- `queries/[queryId]/layout.tsx`: verifica ownership (progetto → query), header con back link, `QuerySubNav` a 4 tab
- `QuerySubNav`: client component con tab bar (Coverage / Citations / Competitors / Recommendations)
- Sidebar aggiornata: quando si è dentro una query, mostra sub-link annidati (Coverage, Citations, Competitors, Recommendations)

#### B.4 — Sub-page Coverage
- `queries/[queryId]/coverage/page.tsx`: `OpportunityMapClient` filtrato sul `targetQueryId` corrente
- Stessa UX dell'Opportunity Map globale, ma scoped alla singola query

#### B.5 — Sub-page Citations
- `queries/[queryId]/citations/page.tsx`: citation detail completo (status, fonti, quote, varianti GSC, Bayesian rate bar)
- `QueryCitationsClient`: client component con button "Run check" → `POST /api/projects/[id]/queries/[qId]/citation-check`
- Nuova API `citation-check/route.ts`: crea job `citation_check` scoped per `targetQueryId`
- i18n: `runCheck`, `checkRunning`, `checkError` (EN + IT)

#### B.6 — Sub-page Competitors
- `queries/[queryId]/competitors/page.tsx`: aggrega `CompetitorQueryAppearance` per competitor
- Mostra rank, nome, dominio, posizione media, numero apparizioni
- `queryCompetitors` namespace i18n (EN + IT)

#### B.7 — Sub-page Recommendations
- `queries/[queryId]/recommendations/page.tsx`: `OptimizationClient` filtrato per `targetQueryId`
- Stessa UX dell'Optimization globale, ma mostra solo le raccomandazioni della query corrente

#### B.8 — Overview aggregator
- Due nuovi widget in fondo all'Overview (visibili solo se c'è uno snapshot):
  - **Top Competitors**: competitor che compaiono più spesso tra tutte le query (da `CompetitorQueryAppearance`)
  - **Citation Gaps**: query dove l'ultimo check non ha rilevato citazione, con link diretto alla sub-page Citations
- i18n: `topCompetitors*` e `citationGaps*` nel namespace `overview` (EN + IT)

---

### Phase A — Fondamenta del loop continuo

#### A.1 — Campo `scheduledAt` su Job
- `scheduledAt DateTime?` aggiunto allo schema Prisma + migration SQL
- `claim_job()` filtra job con `scheduledAt > NOW()`
- ⚠️ Migration da applicare manualmente con superuser DB (vedi `docs/_features/v2-azioni-manuali.md`)

#### A.2 — Scheduler: citation check giornalieri
- `create_daily_citation_jobs()`: crea `scheduled_citation_daily` per progetti attivi
- Limiti piano: free → 3 query/giorno, pro → 10 (proxy: ruolo utente)
- Anti-duplicato: skip se job pending/running già esiste per query+giorno

#### A.3 — Worker: gestione job schedulati
- `scheduled_citation_daily` e `scheduled_citation_burst` → `process_citation_check_enriched_job`
- Nuovi tipi aggiunti a stale-job recovery e dispatch loop

#### A.4 — Booster mode post-full_analysis
- Dopo ogni `full_analysis` riuscita: 21 job burst/query (3/giorno × 7 giorni, ogni 8h)
- `scheduledAt` prestabilito — il worker li raccoglie man mano che scadono

#### A.5 — Scheduler: GSC sync settimanale + full analysis mensile
- `create_weekly_gsc_sync_jobs()`: ogni domenica, solo progetti con GSC attivo + property selezionata
- `create_monthly_analysis_jobs()`: giorno 1 del mese, tutti i progetti attivi
- Refactor: helper `_pending_job_exists()` e `_create_job()` per evitare duplicazione

#### A.6 — Endpoint citation-stats bayesiano
- `GET /api/projects/[id]/citation-stats?queryId=`: `{ rate, lower, upper, intervalWidth, label, trend, stability, totalChecks }`
- Beta(α,β) con prior uniforme Beta(1,1), IC 95% via approssimazione normale
- `lib/citation-stats.ts`: utility condivisa TS. `app/citation_stats.py`: reference Python.

#### A.7 — UI: citation rate bar
- `CitationRateBar`: barra con banda IC 95% (banda colorata), rate %, freccia trend, label pill
- Visibile in ogni `CitationCard` della pagina Queries quando ci sono check disponibili
- Stats calcolate server-side in `queries/page.tsx` (no round-trip extra)
- i18n: `rateTitle`, `rateChecks`, `rateLabel.{stable,learning,uncertain}` in EN + IT

---

### Phase 0 — Infrastructure & Staging

#### 0.1 — Staging database configuration
- Created `.env.staging.example` with all required variables for `visiblee_dev` staging database
- Added Staging Setup section to `README.md` documenting the staging database, OAuth, and Vercel configuration

#### 0.5 — Staging setup documentation
- Created `docs/staging-setup.md` covering DNS, Hetzner DB, Google OAuth, Ploi processes/cron, Vercel project setup, env variables table, smoke test checklist (6 sections), and troubleshooting table

#### 0.4 — Scheduler placeholder
- Created `services/analyzer/app/scheduler.py` — connects to DB, logs "no jobs to create yet", exits
- Documents Ploi cron command inline; full setup in `docs/staging-setup.md` (Task 0.5)

#### 0.3 — Worker/FastAPI separation
- Removed job worker from FastAPI lifespan — `uvicorn app.main:app` starts with no background tasks
- Created `services/analyzer/run_worker.py` as standalone worker entrypoint (`python run_worker.py`)
- Updated README dev setup to reflect two separate processes

#### 0.2 — Vercel staging deployment documentation
- Expanded README Staging section with step-by-step Vercel project setup
- Documented separate Vercel project for `dev` branch, domain `dev.visiblee.ai`
- Documented Google OAuth redirect URIs for staging
- Documented Python microservice staging port strategy
