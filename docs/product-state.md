# Stato del Prodotto — Visiblee v1

> **Data**: Marzo 2026
> **Scopo**: snapshot accurato di cosa esiste, cosa funziona, e cosa è in scope v2.
> **Audience**: progetto Claude.ai — per valutare proposte nuove rispetto a quello che già c'è.

---

## 1. Cosa è live e funzionante

### 1.1 Flusso pubblico (no auth)

**Landing page**
- Hero con form URL + brand name + query target (3 campi)
- Sezione "how it works"
- GA4 solo sul route group `(marketing)`

**Preview analysis (pre-registrazione)**
- L'utente inserisce URL, brand, query → viene avviata una micro-analisi
- Pipeline Python: crawl → segmentazione → fan-out → embedding → scoring → insights LLM
- Pagina risultati: AI Readiness Score, radar chart dei 5 sub-score, insights, sezioni bloccate → CTA registrazione
- Report PDF via email (MailerSend)
- La preview viene convertita in progetto reale al momento della registrazione

### 1.2 Area autenticata

**Auth**
- Google OAuth + email/password via Auth.js v5
- JWT sessions, no session DB (stateless)
- Ruoli: `user` | `admin` | `superadmin`

**Dashboard progetti**
- Lista progetti, nuovo progetto, settings, delete
- Ogni progetto ha: nome, brand, URL, descrizione, `targetLanguage` (ISO 639-1), `targetCountry` (ISO 3166-1)

**Overview**
- AI Readiness Score + 5 sub-score con badge e descrizioni
- Radar chart (Recharts)
- Score history chart (Recharts LineChart) — toggle per sub-score, richiede min 2 snapshot
- Empty state con `SetupChecklist` (localStorage dismiss)

**Queries (sezione dedicata)**
- Aggiunta/rimozione query target (limite: 5 free / 15 pro)
- Textarea multi-linea per inserimento bulk
- Trigger analisi manuale per singola query
- Citation simulation con `TrendDots`, badge "Citato/Non citato", posizione, storico 4 settimane
- Fonti citate espandibili (`CitationCard`), quote supportata, sotto-query Gemini toggle
- Dati da `CitationCheck`: `citedSources`, `userCited`, `userCitedPosition`, `userCitedSegment`, `responseText`, `searchQueries`
- **GSC Query Suggestions**: banner con max 3 query suggerite dal GSC (visibile se GSC connesso e ci sono suggestion pendenti). Ogni suggerimento mostra query, impressioni, intent type, badge "AI query" per query `query_ai_mode`. Azioni: "Accetta" (crea query target) o "Ignora".
- **Citation Variants Panel**: sotto ogni `CitationCard`, pannello collassabile che mostra il risultato della simulazione per ogni profilo audience (es. "Citato per Evaluator pos. 1 / Non citato per Decision Maker").

**Contents (content management)**
- Tab "Da confermare" / "Confermati" / "Scartati"
- Bulk select + azioni bulk (conferma/scarta)
- Discovery job asincrono con `StepLoader`
- Banner "risultati pronti" dopo discovery
- Dopo analisi: dettaglio per ogni contenuto

**Content Detail**
- Per ogni pagina: lista passaggi con `PassageScore` completo (6 sub-criteri)
- `answerFirst` incluso nel select DB (fix 5.4)
- Reasoning testuale per ogni passaggio

**Opportunity Map**
- Per ogni query target: copertura semantica delle sotto-query fan-out
- Chip colorate (verde/giallo/rosso) per coverage tier
- Header con stat card (totale, coperti, gap)
- Legenda e sort toggle

**Competitors**
- Aggiunta manuale competitor (URL)
- Auto-rilevamento da citation simulation
- Trigger job `competitor_analysis`
- Confronto score bar per ogni competitor

**Optimization**
- Raccomandazioni LLM-generated (Claude o Gemini) per progetto
- Ordinate per priorità e impatto stimato
- Status: `pending` | `in_progress` | `completed` | `dismissed`
- Sprint groups

**Audience (sezione GSC — feature flag `NEXT_PUBLIC_GSC_ENABLED`)**
- Nuovo item in sidebar tra "Queries" e "Opportunities"
- **Stato 1 — No GSC connesso**: pagina educativa con 4 profili audience statici in anteprima (opacity ridotta), vantaggi elencati, CTA "Connetti Google Search Console" → rimanda a Settings.
- **Stato 2 — Sync in corso**: `StepLoader` mentre il job `gsc_sync` elabora i dati. Polling via `useJobPolling`.
- **Stato 3 — Profili generati**: card deck per ogni `IntentProfile` con: nome, intent dominante, % del traffico GSC, device dominante, query di esempio, barra "citation impact" (% di varianti con `userCited = true`).

**Notifiche**
- Bell badge nella navbar
- Sheet panel con notifiche recenti
- Pagina storico notifiche
- Tipi: `analysis_complete` | `score_change` | `new_recommendations` | `system`
- Notifiche create dal Python worker al completamento del job

**Onboarding Wizard**
- Dialog 4-step al primo accesso al progetto
- Re-apribile dal sidebar "Come funziona"
- Event-driven (localStorage)

**Settings**
- Edit `targetLanguage` e `targetCountry` su progetti esistenti
- `SearchableSelect` — combobox con live filter, zero dipendenze extra
- **GSC Connection Card** (visibile se `NEXT_PUBLIC_GSC_ENABLED=true`): 3 stati — non connesso (lista vantaggi + bottone connect OAuth), connesso senza property selezionata (radio list proprietà con badge "match"), connesso e attivo (stats: property URL, ultimo sync, query importate, profili generati, bottone "Sync ora", link "Disconnetti"). Polling `useJobPolling` mentre job `gsc_sync` è attivo.

**Admin panel**
- Lista utenti, gestione ruoli, seed superadmin

**Loop continuo automatico (Fase A)**
- `scheduler.py` (cron Ploi): crea job giornalieri per citation check (limiti piano: 3 free / 10 pro), GSC sync domenicale, full analysis mensile
- Booster mode: dopo ogni `full_analysis` vengono creati automaticamente 3 citation check/giorno × 7 giorni per query (21 job/query con `scheduledAt` scaglionati di 8h)
- Campo `scheduledAt` su `Job`: il worker ignora i job schedulati nel futuro
- Citation rate bayesiano: modello Beta(α,β) con prior uniforme — calcola rate, IC 95%, label (stable/learning/uncertain), trend (up/down/flat)
- `CitationRateBar`: barra con banda di confidenza visibile in ogni `CitationCard` della pagina Queries
- `GET /api/projects/[id]/citation-stats?queryId=`: endpoint che espone le stats bayesiane per integrazioni future

**Navigazione query-centrica (Fase B)**
- Ogni query target ora ha una propria area dedicata: `/app/projects/[id]/queries/[queryId]` con 4 sub-tab
- **Coverage**: `OpportunityMapClient` filtrato sul `targetQueryId` — mostra solo le sotto-query della query selezionata
- **Citations**: citation detail completo (status citazione, fonti, quote AI, varianti GSC, Bayesian rate bar) + bottone "Run check" per lanciare un check manuale sulla singola query
- **Competitors**: lista competitor rilevati nelle citation (da `CompetitorQueryAppearance`) con posizione media e frequenza
- **Recommendations**: `OptimizationClient` filtrato per `targetQueryId` — solo le raccomandazioni di quella query
- **Overview aggregator**: due widget nella pagina Overview — "Top Competitors" cross-query + "Citation Gaps" (query non citate con link diretto)
- `CompetitorQueryAppearance`: nuova tabella che traccia ogni apparizione competitor per query e citation check
- `targetQueryId` su `Recommendation`: le raccomandazioni generate con un `targetQueryId` sono associabili alla singola query

---

## 2. Architettura tecnica attuale

### 2.1 Stack

| Layer | Tecnologia |
|---|---|
| Frontend | Next.js 14+ App Router |
| UI | shadcn/ui (New York style) + Tailwind CSS + Zinc base |
| i18n | next-intl, EN + IT, no URL prefix, cookie `NEXT_LOCALE` |
| Auth | Auth.js v5 (NextAuth), Google OAuth + credentials, JWT |
| Database | PostgreSQL + pgvector |
| ORM | Prisma (client output in `lib/generated/prisma`) |
| Python service | FastAPI su server Hetzner separato |
| Embeddings | Voyage AI (`voyage-3`, dim 1024) |
| Fan-out | Gemini API (`gemini-2.0-flash`) |
| Citation check | Gemini API + Google Search Grounding |
| Discovery | Brave Search API + Gemini classificazione |
| GSC sync | Google Search Console API (`webmasters.readonly`) |
| Email | MailerSend (report PDF + transazionali) |
| Analytics | GA4 solo su `(marketing)` route group |
| Deploy | Vercel (frontend) + Hetzner via Ploi (2 server: DB + Python) |
| Costi margine | ~$0.002 fan-out + ~$0.006 embedding per analisi |

### 2.2 Route groups Next.js

```
(marketing)/     → landing, preview, GA4
(auth)/          → login, register
(app)/           → area autenticata, no GA4
(admin)/         → superadmin panel
api/             → API routes Next.js
```

### 2.3 Primitive condivise (non negoziabili)

- **`StepLoader`** (`components/ui/step-loader.tsx`): loader per tutti i job asincroni. Props: `title`, `subtitle`, `steps[]`, `pollingText?`, `skeleton` (`score-rows` | `content-rows`). Usare sempre, non inventare loader custom.
- **`useJobPolling`** (`hooks/use-job-polling.ts`): polling loop standardizzato. Usa `useRef` internamente per `isDone`/`onDone` — nessun stale closure. Accetta `onDone` override. Sempre `router.refresh()` dopo creazione job. Nota: i componenti che tracciano job completion devono interrogare lo stato del job (es. `/setup-status?analysisRunning`), non comparare timestamp snapshot (anti-pattern che causa race condition).
- **`SearchableSelect`** (`components/ui/searchable-select.tsx`): combobox con live filter, no deps extra.

### 2.4 Job types nel DB

```
'preview_analysis'             → micro-analisi dalla landing
'discovery'                    → Brave + Gemini classificazione
'fetch_content'                → crawl + segmentazione
'full_analysis'                → pipeline completa scoring
'citation_check'               → Gemini Grounding per query
'competitor_analysis'          → analisi pagina competitor
'gsc_sync'                     → pull dati GSC + classificazione intent + generazione profili
'citation_check_enriched'      → citation check con varianti per profilo audience
'scheduled_citation_daily'     → citation check automatico giornaliero (scheduler)
'scheduled_citation_burst'     → citation check ad alta frequenza post-analisi (7gg × 3/giorno)
'scheduled_gsc_sync'           → GSC sync automatico domenicale (scheduler)
'scheduled_analysis'           → full analysis automatica mensile (scheduler)
```

### 2.5 Schema DB — tabelle principali

| Tabella | Contenuto |
|---|---|
| `users` | utenti, auth, ruolo, locale |
| `projects` | brand, URL, targetLanguage, targetCountry |
| `target_queries` | query target per progetto (max 15) |
| `fanout_queries` | sotto-query generate da Gemini (10 per target query) |
| `contents` | pagine scoperte/confermate |
| `passages` | segmenti di testo con metriche |
| `passage_scores` | 6 sub-criteri per passaggio |
| `fanout_coverage_map` | similarity score passage↔fanout query |
| `project_score_snapshots` | snapshot storico dei 5 score |
| `content_scores` | score per contenuto per snapshot |
| `citation_checks` | risultati verifica citazione Gemini |
| `citation_check_variants` | varianti del citation check per profilo audience (GSC) |
| `competitors` | competitor rilevati/manuali |
| `competitor_contents` | pagine analizzate dei competitor |
| `recommendations` | raccomandazioni con status |
| `jobs` | job queue asincrona |
| `notifications` | notifiche in-app |
| `gsc_connections` | token OAuth GSC (AES-256-GCM), property selezionata, status |
| `gsc_query_data` | query reali da GSC API (90 gg): click, impressioni, CTR, position, intent classificato |
| `intent_profiles` | profili audience generati dal GSC data (2-4 per progetto): nome, slug, context prompt |
| `gsc_query_suggestions` | query suggerite basate su similarità con target esistenti; status: `pending`/`accepted`/`dismissed` |

### 2.6 API routes GSC (feature-flag `NEXT_PUBLIC_GSC_ENABLED`)

```
GET  /api/gsc/connect?projectId=...        → redirect OAuth Google
GET  /api/gsc/callback                     → token exchange, salva tokens criptati
GET  /api/gsc/properties?projectId=...     → lista proprietà GSC dell'utente
POST /api/gsc/select-property              → seleziona property, lancia gsc_sync job
POST /api/gsc/sync                         → lancia manualmente gsc_sync job
GET  /api/gsc/status?projectId=...         → stato connessione + pendingJobId
POST /api/gsc/disconnect                   → revoca e cancella connessione
GET  /api/gsc/suggestions?projectId=...   → lista suggestion pending
PATCH /api/gsc/suggestions/[id]            → accetta o ignora un suggerimento
```

---

## 3. Cosa funziona bene (non toccare)

- Il polling pattern `useJobPolling` + `router.refresh()`: non va sostituito con WebSocket o SSE — il costo non è giustificato.
- Lo scoring euristico sui passaggi: deterministico, senza LLM, ~$0.002 per analisi. Non va convertito a LLM-based.
- La citation verification via Gemini Grounding: l'unica fonte ufficiale per citazioni Google strutturate. Non sostituire con scraping.
- Il competitor analysis automatico dai citation checks: il differenziatore principale del prodotto.
- Il limite di 15 query target: computazionalmente motivato.
- `StepLoader` e `useJobPolling` come standard per tutti i job.
- La classificazione intent GSC con euristiche (regex IT+EN): deterministica, zero costi LLM.

---

## 4. Limitazioni note e debito tecnico

### 4.1 Limitazioni prodotto

- **Solo Google AI Mode / AI Overviews**: nessun supporto ChatGPT/Perplexity (no API equivalenti disponibili). Nella roadmap v2.
- **No rate limiting implementato**: il microservizio Python non ha rate limiting per utente.
- **No piani/billing**: nessun sistema di abbonamento implementato. Le regole dei piani (es. max 5 query free) sono applicate a livello di codice ma non c'è billing reale.
- **No multi-user per progetto**: i progetti appartengono a un singolo utente. Sharing/team non implementato.
- **No export CSV**: nella roadmap commerciale ma non implementato.
- **No white-label**: nella roadmap Agency tier ma non implementato.
- **Scheduled jobs implementati ma DB migration pendente**: lo scheduler e i job types schedulati sono implementati (Fase A), ma il campo `scheduledAt` su `jobs` richiede una migration manuale con superuser. Vedi `docs/_features/v2-azioni-manuali.md`.
- **No Share of Model tracking**: nella roadmap v2.
- **GSC feature flag**: l'intera feature GSC è dietro `NEXT_PUBLIC_GSC_ENABLED=true`. Non attiva in produzione senza configurazione OAuth.

### 4.2 Debito tecnico

- Il `Job` model non ha una priority queue: i job vengono processati in ordine di creazione, non per urgenza.
- `rawHtml` salvato su DB per ogni contenuto: può diventare un problema di storage con molti contenuti.
- `llmReasoning` in `PassageScore`: campo testo libero — non strutturato, difficile da indicizzare o aggregare.
- Lo schema `Competitor` non ha sub-score separati come i `Content`: solo `avgPassageScore`.
- I `FanoutQuery` vengono rigenerati ad ogni analisi senza eliminare i vecchi — crescita indefinita della tabella.

---

## 5. Perché alcune cose non sono state fatte

| Cosa | Perché no |
|---|---|
| LLM scoring passaggi | Costo ($30/analisi) + non deterministico |
| WebSocket per job progress | Overkill — polling + router.refresh() è sufficiente |
| URL prefix per i18n | Scelta architetturale: routes sempre in inglese, lingua da cookie |
| Scraping ChatGPT/Perplexity | ToS violation + inaffidabile |
| Auto-scheduling citation checks | Implementato in Fase A — scheduler + job types schedulati + booster mode |
| LLM per classificazione intent GSC | Costo + non deterministico: regex euristiche IT+EN sufficienti |
| Dashboard analytics usage | Non priorità v1 |
| Multi-tenant / team | Non in scope v1 |
