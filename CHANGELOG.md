# Changelog

## [Unreleased]

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
