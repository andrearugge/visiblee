# Changelog

## [Unreleased]

### Phase D — GEO Expert

#### D.1 — Modelli Prisma ExpertConversation + ExpertMessage
- Schema: aggiunto `ExpertConversation` (id, projectId, recommendationId?, targetQueryId?, title, contextPayload, status, timestamps) + `ExpertMessage` (id, conversationId, role, content, createdAt)
- Migration SQL manuale: `20260401000003_add_expert_models`
- Relazione `expertConversations` aggiunta a `Project`

#### D.2 — API GEO Expert
- `POST /api/projects/[id]/expert/conversations`: crea conversazione con `contextPayload` pre-caricato. Genera messaggio iniziale con Gemini Flash (best-effort fallback statico). Limite: 50 conversazioni per progetto (Free).
- `GET /api/projects/[id]/expert/conversations`: lista conversazioni ordinate per `updatedAt`
- `POST /api/projects/[id]/expert/conversations/[convId]/messages`: invia messaggio utente → Gemini Flash con history completa + system prompt → salva risposta. Limite: 30 messaggi per conversazione.
- `GET /api/projects/[id]/expert/conversations/[convId]/messages`: recupera conversazione con tutti i messaggi
- Dipendenza: `@google/genai` (JS SDK equivalente al `google-genai` Python già in uso)

#### D.3 — UI GEO Expert
- `expert/page.tsx`: lista conversazioni con titolo, data, conteggio messaggi, badge status
- `expert/[convId]/page.tsx`: chat view con header (titolo + back link) e `ExpertChat` client
- `ExpertChat`: componente chat con history messaggi, area input (Enter = invio, Shift+Enter = newline), invio ottimistico, gestione errori e limite messaggi
- `app-sidebar.tsx`: aggiunto link "GEO Expert" (icona `MessageSquare`) nella sidebar di progetto
- i18n EN + IT: namespace `expert` (12 chiavi)

#### D.4 — CTA "Ottimizza con GEO Expert"
- `OptimizationClient`: aggiunto prop opzionale `queryContext` (queryId, queryText, topCompetitorName). Pulsante "Ottimizza con GEO Expert" su ogni raccomandazione non dismissata quando `queryContext` è presente.
- Il pulsante crea una nuova conversazione con `contextPayload` (rec + query + top competitor) e redirige alla chat
- `QueryRecommendationsPage`: passa `queryContext` con testo query + top competitor da `CompetitorQueryAppearance`
- i18n EN + IT: `optimizeWithExpert`, `expertLimitReached`, `expertOpening` nel namespace `optimization`

---

### Phase C — Miglioramento setup

#### C.1 — Sitemap Import
- `sitemap_import.py`: parser Python che scarica sitemap.xml (+ sitemap_index), estrae URL, filtra per dominio e media extension
- `worker.py`: job type `sitemap_import` → `process_sitemap_import_job()` → INSERT con `source='sitemap'`, `isConfirmed=true`
- `POST /api/projects/[id]/sitemap-import`: crea job (evita duplicati pending/running)
- `GET /api/projects/[id]/sitemap-import`: restituisce `{ running: boolean }` per polling
- `ContentsClient`: pulsante "Importa da sitemap" nel toolbar e nell'empty state, banner blu while import in corso, `useJobPolling` con `router.refresh()` al completamento
- i18n EN + IT: `sitemapImport`, `sitemapImportRunning`, `sitemapImportError`

#### C.2 — Confidence badges + detectedLanguage
- Schema: aggiunto `detectedLanguage String?` a `Content` + migration SQL
- `ContentsClient`: badge alta/media/bassa attendibilità sui contenuti non confermati
- Badge viola "Lingua diversa dal target" se `detectedLanguage ≠ targetLanguage`
- Filtro rapido "Solo bassa attendibilità" nel toolbar
- `discovery.py`: prompt Gemini aggiornato per restituire `language` (ISO 639-1)
- `worker.py`: salva `detectedLanguage` nell'upsert discovery
- i18n EN + IT: `confidence*`, `filterLowConfidence`, `langMismatch`

#### C.3 — GSC nel setup checklist
- `SetupChecklist`: step 0 opzionale "Connetti GSC" (prima di Aggiungi query)
- CTA → `/api/gsc/connect?projectId=...`, link "Salta" → localStorage
- Dipendente da `gscEnabled` (feature flag) e `initialGscConnected`
- Overview page: query GscConnection, legge `NEXT_PUBLIC_GSC_ENABLED`
- Step icons dinamiche (5 con GSC, 4 senza)
- i18n EN + IT: `step0*` nel namespace `setup`

#### C.4 — Setup banner pervasivo
- `SetupBanner`: banner compatto (amber) su tutte le pagine del progetto
- Fetch `setup-status` on mount, mostra N/M e link all'Overview
- Auto-dismiss quando setup completo, dismiss manuale via X → localStorage
- `ProjectLayout`: aggiunto `SetupBanner` prima di `children`
- i18n EN + IT: namespace `setupBanner`

---

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
