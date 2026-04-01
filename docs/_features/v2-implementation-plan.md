# Istruzioni per Claude Code — Visiblee v2

> **Copia questo file nella root del repository come `docs/v2-implementation-plan.md`.**
> **Quando lavori con Claude Code, inizia ogni sessione con**: "Leggi `docs/v2-implementation-plan.md` e `CLAUDE.md` prima di fare qualsiasi cosa."

---

## Contesto

Visiblee v2 è una ristrutturazione UX e architetturale del prodotto. Le specifiche complete sono in `docs/v2-specs-ux-architecture.md` (il documento di riferimento — leggilo per intero prima di iniziare qualsiasi task).

Il prodotto è attualmente alla fine della Fase 5. Tutte le fasi 1-5 sono complete e funzionanti. Non rompere nulla di ciò che esiste.

---

## Regole di lavoro

### 1. Un task alla volta

Non implementare mai più di un task per sessione. Il flusso è:

```
1. Leggi il task
2. Leggi i file coinvolti nel repository
3. Implementa
4. Verifica (test, build, lint)
5. Commit con messaggio convenzionale
6. Aggiorna CLAUDE.md (status del task)
7. STOP — aspetta conferma prima del task successivo
```

Se un task è troppo grande per una singola sessione, spezzalo in sub-task e proponi la suddivisione PRIMA di iniziare a scrivere codice.

### 2. Verifica prima di procedere

Dopo ogni task, esegui TUTTI questi check:

```bash
# TypeScript
cd apps/web && npx tsc --noEmit

# Lint
npm run lint

# Build Next.js (verifica che non ci siano errori di build)
npm run build

# Prisma (se lo schema è cambiato)
npx prisma generate
npx prisma migrate dev --name <nome-descrittivo>

# Python (se il codice Python è cambiato)
cd services/analyzer
python -c "from app.main import app; print('OK')"
```

Se uno di questi fallisce, fixalo PRIMA di fare il commit. Non lasciare mai il repository in uno stato rotto.

### 3. Git

- Branch per ogni fase: `feature/v2-fase-0`, `feature/v2-fase-a`, etc.
- Commit convenzionali: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- Un commit = un task logico. Mai commit multi-task.
- Alla fine di ogni fase, apri PR verso `dev` (non `main`).

### 4. Changelog

Mantieni un file `CHANGELOG.md` nella root del repository. Formato:

```markdown
# Changelog

## [Unreleased]

### Phase 0 — Infrastructure & Staging

#### 0.1 — Staging database
- Created `visiblee_dev` database configuration
- Added `.env.staging` example

#### 0.2 — Vercel staging deployment
- Configured Vercel project for `dev` branch
- Domain: dev.visiblee.ai

(etc.)
```

Aggiorna il changelog ad ogni task completato. Non accumulare — scrivi subito.

### 5. Documentazione

Alla fine di ogni FASE completata (non di ogni task):

1. **Aggiorna `CLAUDE.md`**: compatta i task completati in formato tabellare (come le fasi 1-5 esistenti). Aggiorna "Current state" con la fase corrente.

2. **Aggiorna `docs/product-state.md`**: aggiungi le feature implementate, i nuovi job types, le nuove tabelle DB, le limitazioni risolte.

3. **Aggiorna `docs/architectural-decisions.md`**: se una fase introduce una nuova decisione architetturale non ovvia (es. separazione worker, modello bayesiano), aggiungi un nuovo ADR con lo stesso formato delle 15 esistenti.

4. **Aggiorna `README.md`**: se cambiano i comandi di setup, la struttura del progetto, o i prerequisiti.

Non aggiornare i docs durante l'implementazione dei task — solo alla fine della fase, quando tutto è verificato e stabile.

### 6. Cosa NON fare

- **Non cambiare lo scoring euristico** (AD-02). Mai.
- **Non aggiungere dipendenze npm/pip senza motivo**. Se serve una libreria, verifica prima che non ci sia già un'alternativa nel progetto.
- **Non creare componenti UI custom** se esiste un equivalente shadcn/ui.
- **Non hardcodare stringhe utente** — tutto in `messages/en.json` e `messages/it.json`.
- **Non toccare le fasi precedenti** (1-5) salvo bugfix espliciti.
- **Non fare refactoring "per migliorare"** — solo cambiamenti richiesti dal task corrente.
- **Non inventare soluzioni non documentate nelle specifiche**. Se un caso non è coperto, fermati e chiedi.

---

## Piano di implementazione

### Fase 0 — Infrastruttura e staging

**Branch**: `feature/v2-fase-0`
**Prerequisito**: nessuno
**Reference**: sezione 6, Fase 0 in `docs/v2-specs-ux-architecture.md`

| Task | Cosa fare | File coinvolti | Verifica |
|---|---|---|---|
| 0.1 | Creare configurazione per database staging `visiblee_dev`. Aggiungere `.env.staging.example` con le variabili necessarie. | `.env.staging.example`, `README.md` | Il file `.env.staging.example` esiste ed è documentato |
| 0.2 | Documentare la procedura di setup Vercel per il branch `dev` con dominio `dev.visiblee.ai`. Aggiungere sezione "Staging" nel README. | `README.md` | La documentazione è chiara e completa |
| 0.3 | Separare il worker da FastAPI. Creare `services/analyzer/run_worker.py` come entrypoint standalone. Rimuovere il worker dal lifespan di FastAPI. FastAPI deve avviarsi senza worker. Il worker deve avviarsi indipendentemente. | `services/analyzer/app/main.py`, `services/analyzer/run_worker.py`, `services/analyzer/app/worker.py` | `uvicorn app.main:app` parte senza worker. `python run_worker.py` parte e processa job. Entrambi funzionano in parallelo. |
| 0.4 | Creare `services/analyzer/app/scheduler.py` — placeholder per il cron. Lo script si connette al DB e per ora logga "Scheduler run — no jobs to create yet" e esce. Aggiungere documentazione Ploi per configurare il cron. | `services/analyzer/app/scheduler.py`, `README.md` | `python -m app.scheduler` si esegue senza errori |
| 0.5 | Creare `docs/staging-setup.md` con la procedura completa di setup staging: Vercel config, Hetzner config, environment variables, OAuth redirect URI, DNS. | `docs/staging-setup.md` | Il documento copre tutti i passi necessari |
| 0.6 | Smoke test manuale (non automatizzabile da Claude Code). Documenta la checklist di test in `docs/staging-setup.md`. | `docs/staging-setup.md` | La checklist esiste |

**Alla fine della Fase 0**: aggiorna `CLAUDE.md`, `CHANGELOG.md`, `docs/product-state.md`.

---

### Fase A — Fondamenta del loop continuo

**Branch**: `feature/v2-fase-a`
**Prerequisito**: Fase 0 completata e staging funzionante
**Reference**: sezione 3.7 in `docs/v2-specs-ux-architecture.md`

| Task | Cosa fare | File coinvolti | Verifica |
|---|---|---|---|
| A.1 | Aggiungere `scheduledAt DateTime?` al modello `Job` in Prisma. Migration. Aggiornare `claim_job()` nel worker per ignorare job con `scheduledAt` nel futuro. | `apps/web/prisma/schema.prisma`, `services/analyzer/app/worker.py` | Migration OK. Il worker ignora job con `scheduledAt > NOW()`. Job senza `scheduledAt` funzionano come prima. |
| A.2 | Implementare la logica in `scheduler.py`: enumera progetti attivi, crea job `scheduled_citation_daily` per ciascuno (1 per query target). Rispetta i limiti di piano (3 query free, 10 query pro). Aggiungere logica per evitare duplicati (non creare job se esiste già un pending per la stessa query/giorno). | `services/analyzer/app/scheduler.py` | Lo script crea i job corretti. Non crea duplicati se eseguito due volte. |
| A.3 | Aggiungere gestione di `scheduled_citation_daily` e `scheduled_citation_burst` nel worker. Questi job eseguono `run_citation_check_enriched` per una singola query (non per tutte). Il payload contiene `targetQueryId`. | `services/analyzer/app/worker.py` | Un job `scheduled_citation_daily` viene processato e salva il `CitationCheck` nel DB. |
| A.4 | Implementare booster mode: quando un job `full_analysis` completa con successo, creare automaticamente job `scheduled_citation_burst` per i successivi 7 giorni (3/giorno, schedulati con `scheduledAt` a distanza di 8 ore l'uno dall'altro). | `services/analyzer/app/worker.py` (nella funzione `process_full_analysis_job`) | Dopo una `full_analysis`, i job burst appaiono nella tabella `jobs` con `scheduledAt` corretto. |
| A.5 | Aggiungere `scheduled_gsc_sync` e `scheduled_analysis` allo scheduler. GSC sync: settimanale (solo domenica) per progetti con GSC attivo. Full analysis: mensile (solo giorno 1) per tutti i progetti attivi. | `services/analyzer/app/scheduler.py` | Lo scheduler crea i job corretti il giorno giusto. |
| A.6 | Creare endpoint API `GET /api/projects/[id]/citation-stats?queryId=...` che calcola il modello bayesiano Beta(α, β) on-the-fly dalla tabella `citation_checks`. Restituisce: `{ rate, lower, upper, intervalWidth, label, trend, stability, totalChecks }`. | `apps/web/app/api/projects/[id]/citation-stats/route.ts`, calcolo Beta in Python: `services/analyzer/app/citation_stats.py` | L'endpoint restituisce dati corretti per una query con N citation checks. |
| A.7 | Aggiornare la UI della sezione Citation nella pagina Queries per mostrare: barra con banda di confidenza, label testuale, trend direzionale. Usare i dati dall'endpoint A.6. | `apps/web/components/features/citation-rate-bar.tsx`, aggiornare la pagina queries | La barra si renderizza con dati reali. Le label cambiano in base alla larghezza dell'intervallo. |

**Alla fine della Fase A**: aggiorna `CLAUDE.md`, `CHANGELOG.md`, `docs/product-state.md`, `docs/architectural-decisions.md` (nuovo ADR per il modello bayesiano e per la separazione worker/scheduler).

---

### Fase B — Navigazione query-centrica

**Branch**: `feature/v2-fase-b`
**Prerequisito**: Fase A completata
**Reference**: sezioni 2 e 3.6 in `docs/v2-specs-ux-architecture.md`

| Task | Cosa fare | Verifica |
|---|---|---|
| B.1 | Aggiungere `targetQueryId String?` a `Recommendation` in Prisma. Migration. Aggiornare `generate_recommendations()` nel Python per popolare il campo quando il contesto include una query specifica. | Migration OK. Le nuove raccomandazioni hanno `targetQueryId` popolato. Le vecchie restano con `null`. |
| B.2 | Creare tabella `CompetitorQueryAppearance` in Prisma. Migration. Aggiornare `save_citation_checks()` per popolare la tabella automaticamente ad ogni citation check. | Migration OK. Dopo un citation check, le apparizioni competitor sono salvate. |
| B.3 | Creare route layout per la query singola: `/app/projects/[id]/queries/[queryId]/`. Sub-pagine: `coverage`, `citations`, `competitors`, `recommendations`. Sidebar aggiornata con la struttura query-centrica. | Le pagine si caricano. La sidebar mostra la struttura corretta. |
| B.4 | Migrare la logica di Opportunity Map dalla pagina globale alla sub-pagina `coverage` della singola query. Filtrare i fanout queries per `targetQueryId`. | La coverage map mostra solo i dati della query selezionata. |
| B.5 | Migrare la logica citation dalla pagina globale alla sub-pagina `citations` della singola query. Includere il CitationRate bar (da Fase A). | Le citazioni mostrano solo i dati della query selezionata con il rate bayesiano. |
| B.6 | Creare la sub-pagina `competitors` della singola query. Mostra i competitor citati per QUESTA query, con frequenza di apparizione (da `CompetitorQueryAppearance`) e gap report inline. | I competitor mostrati sono quelli rilevanti per la query. |
| B.7 | Creare la sub-pagina `recommendations` della singola query. Filtra per `targetQueryId`. | Le raccomandazioni mostrate sono quelle della query. |
| B.8 | Ristrutturare l'Overview come aggregator: AI Readiness Score globale, top competitor cross-query, contenuti con conflitti (contenuti serviti da 3+ query). | L'Overview mostra dati aggregati coerenti. |

**Alla fine della Fase B**: aggiorna `CLAUDE.md`, `CHANGELOG.md`, `docs/product-state.md`, `docs/user-guide.md` (la navigazione è cambiata).

---

### Fase C — Miglioramento setup

**Branch**: `feature/v2-fase-c`
**Prerequisito**: Fase B completata
**Reference**: sezioni 3.1 e 3.2 in `docs/v2-specs-ux-architecture.md`

| Task | Cosa fare | File coinvolti | Verifica |
|---|---|---|---|
| C.1 | Aggiungere job type `sitemap_import`. Creare `sitemap_import.py` in Python che scarica `sitemap.xml` (e sitemap_index, max 20 child), estrae URL `<loc>`, filtra per stesso dominio ed estensioni media, deduplica. Il job inserisce i contenuti con `source='sitemap'`, `contentType='own'`, `isConfirmed=true`. Aggiungere `POST /api/projects/[id]/sitemap-import` per creare il job (anti-duplicato su pending/running) e `GET` per polling (`{ running: boolean }`). Aggiungere pulsante "Importa da sitemap" nel toolbar di `ContentsClient` con banner durante import e `useJobPolling` con default `router.refresh()`. | `services/analyzer/app/sitemap_import.py`, `services/analyzer/app/worker.py`, `apps/web/app/api/projects/[id]/sitemap-import/route.ts`, `apps/web/components/features/contents-client.tsx`, `apps/web/app/(app)/app/projects/[id]/contents/page.tsx` | Cliccando "Importa da sitemap", il job viene creato. Il worker lo processa. I contenuti appaiono confermati nella sezione Contents. Il banner blu scompare al completamento e i contenuti si aggiornano. |
| C.2 | Aggiungere `detectedLanguage String?` al modello `Content` in Prisma. Migration SQL manuale (utente non ha permessi shadow DB). Aggiornare il prompt Gemini in `discovery.py` per restituire `language` (ISO 639-1) nella classificazione. Il worker salva `detectedLanguage` nell'upsert discovery. In `ContentsClient`: badge alta/media/bassa confidence sui contenuti non confermati (verde ≥ 0.7, amber ≥ 0.4, rosso < 0.4), badge viola "lingua diversa dal target" se `detectedLanguage ≠ targetLanguage`, filtro rapido "Solo bassa confidence" nel toolbar. La page server passa `targetLanguage` dal progetto. | `apps/web/prisma/schema.prisma`, `apps/web/prisma/migrations/YYYYMMDD_add_detected_language/migration.sql`, `services/analyzer/app/discovery.py`, `services/analyzer/app/worker.py`, `apps/web/components/features/contents-client.tsx`, `apps/web/app/(app)/app/projects/[id]/contents/page.tsx` | I badge compaiono correttamente. Il filtro mostra solo contenuti con `discoveryConfidence < 0.4`. I contenuti in lingua diversa dal target mostrano il badge viola. |
| C.3 | Aggiungere step 0 opzionale "Connetti GSC" al `SetupChecklist`, prima di "Aggiungi query target". Condizionale a `gscEnabled` (flag `NEXT_PUBLIC_GSC_ENABLED`). CTA: naviga a `/api/gsc/connect?projectId=...`. Link "Salta": salva `gsc_skipped_{projectId}` in localStorage. Step "done" se GSC già connesso (`gscConnection` nel DB) o skippato via localStorage. La page Overview query `GscConnection` e legge l'env var, passa `initialGscConnected` e `gscEnabled` a `OverviewEmpty` → `SetupChecklist`. Aggiornare array icone (5 step con GSC, 4 senza). | `apps/web/components/features/setup-checklist.tsx`, `apps/web/components/features/overview-empty.tsx`, `apps/web/app/(app)/app/projects/[id]/overview/page.tsx` | Con GSC abilitato: checklist mostra 5 step, lo step 0 GSC è "done" se connesso o skippato. Senza GSC abilitato: comportamento identico a prima (4 step). |
| C.4 | Creare `SetupBanner` — componente client leggero che appare in cima a ogni pagina del progetto finché il setup non è completo. Fetch `GET /api/projects/[id]/setup-status` on mount. Mostra: barra di progresso N/M, label testuale, link all'Overview per il checklist completo, pulsante X per dismiss permanente (localStorage `setup_banner_dismissed_{projectId}`). Auto-dismiss quando setup base completato (queryCount > 0, contentCount > 0, confirmedCount > 0). Aggiungere `SetupBanner` nel `ProjectLayout` dopo `OnboardingWizard`. | `apps/web/components/features/setup-banner.tsx`, `apps/web/app/(app)/app/projects/[id]/layout.tsx` | Il banner appare su Contents, Queries, Competitors, ecc. quando setup incompleto. Scompare (e non riappare) dopo dismiss o completamento. Non appare se già dismissato in precedenza. |

**Alla fine della Fase C**: aggiorna `CLAUDE.md`, `CHANGELOG.md`, `docs/product-state.md`, `docs/user-guide.md` (il flusso di setup è cambiato — GSC opzionale prima delle query, banner pervasivo su tutte le pagine, sitemap import nella sezione Contents, badge confidence e lingua nella review dei contenuti).

---

### Fase D — GEO Expert

**Branch**: `feature/v2-fase-d`
**Prerequisito**: Fase C completata
**Reference**: sezione 3.3 in `docs/v2-specs-ux-architecture.md`

| Task | Cosa fare | File coinvolti | Verifica |
|---|---|---|---|
| D.1 | Aggiungere modelli `ExpertConversation` e `ExpertMessage` in Prisma. `ExpertConversation`: `id`, `projectId`, `recommendationId String?`, `targetQueryId String?`, `title`, `contextPayload Json`, `status` (`'active'`/`'archived'`), `createdAt`, `updatedAt`. `ExpertMessage`: `id`, `conversationId`, `role` (`'user'`/`'assistant'`/`'system'`), `content`, `createdAt`. Migration SQL manuale. | `apps/web/prisma/schema.prisma`, `apps/web/prisma/migrations/YYYYMMDD_add_expert_models/migration.sql` | Migration OK. Tabelle `expert_conversations` e `expert_messages` esistono nel DB. |
| D.2 | Creare endpoint `POST /api/projects/[id]/expert/conversations` (crea conversazione con contesto pre-caricato da `recommendationId` o `targetQueryId`) e `POST /api/projects/[id]/expert/conversations/[convId]/messages` (invia messaggio utente → chiama Gemini Flash con history + system prompt con `contextPayload` → salva risposta). Max 30 messaggi per conversazione. | `apps/web/app/api/projects/[id]/expert/conversations/route.ts`, `apps/web/app/api/projects/[id]/expert/conversations/[convId]/messages/route.ts` | Un `POST` alle API crea la conversazione e restituisce il primo messaggio dell'assistente contestualizzato. Il secondo `POST` aggiunge un messaggio utente e restituisce la risposta dell'LLM. |
| D.3 | Creare la sezione GEO Expert: route `/app/projects/[id]/expert` con lista conversazioni (titolo, data, status) + link per aprire. Route `/app/projects/[id]/expert/[convId]` con chat view (bollette alternati user/assistant, textarea per nuovo messaggio, invio). Aggiungere link "GEO Expert" nella sidebar del progetto. | `apps/web/app/(app)/app/projects/[id]/expert/page.tsx`, `apps/web/app/(app)/app/projects/[id]/expert/[convId]/page.tsx`, `apps/web/components/features/expert-chat.tsx`, layout/sidebar | La sezione GEO Expert è accessibile dalla sidebar. La lista conversazioni mostra le conversazioni esistenti. La chat view mostra i messaggi e permette di inviarne di nuovi. |
| D.4 | Aggiungere CTA "Ottimizza con GEO Expert" nelle raccomandazioni (sub-page recommendations di ogni query). Il CTA crea una nuova conversazione con `contextPayload` che include: dati della raccomandazione, dati della query, contenuto coinvolto, gap report del competitor migliore (se disponibile). Redirige alla chat aperta. Limits: max 50 conversazioni (free) / illimitate (pro). | `apps/web/app/(app)/app/projects/[id]/queries/[queryId]/recommendations/page.tsx`, `apps/web/components/features/optimization-client.tsx` | Cliccando "Ottimizza con GEO Expert" da una raccomandazione, si apre una nuova conversazione con contesto pre-caricato e un messaggio iniziale dell'assistente che analizza il gap. |

**Alla fine della Fase D**: aggiorna `CLAUDE.md`, `CHANGELOG.md`, `docs/product-state.md`, `docs/user-guide.md`, `docs/architectural-decisions.md` (nuovo ADR: LLM per chat/consulenza vs zero-LLM per scoring — distinzione tra AD-02 e GEO Expert).

---

### Fase E — Personas manuali (bassa priorità)

**Branch**: `feature/v2-fase-e`
**Prerequisito**: Fase D completata
**Reference**: sezioni 3.4 e 5.2 in `docs/v2-specs-ux-architecture.md`

| Task | Cosa fare | File coinvolti | Verifica |
|---|---|---|---|
| E.1 | Aggiungere campi a `IntentProfile` in Prisma: `source String` (default `'gsc'`), `manualDescription String?`, `manualSampleQueries String[]`. Migration SQL. | `apps/web/prisma/schema.prisma`, `apps/web/prisma/migrations/YYYYMMDD_add_intent_profile_manual/migration.sql` | Migration OK. I profili GSC esistenti hanno `source='gsc'`. |
| E.2 | Creare form "Aggiungi persona manuale" nella sezione Audience (3 campi: nome persona, descrizione, query esempio). I profili manuali appaiono nella lista affiancati a quelli GSC con badge "Manual". I profili manuali hanno un pulsante elimina; quelli GSC no (rigenerati ad ogni sync). | `apps/web/app/(app)/app/projects/[id]/audience/page.tsx`, componente form | Il form crea una persona manuale. La lista mostra sia profili GSC che manuali con badge distinti. |
| E.3 | Aggiungere endpoint `POST /api/projects/[id]/intent-profiles` per creare profili manuali. Generare `contextPrompt` combinando `manualDescription` + `manualSampleQueries` (stesso formato dei profili GSC). I profili manuali sopravvivono al GSC sync (che non li tocca). | `apps/web/app/api/projects/[id]/intent-profiles/route.ts` | La creazione salva il profilo. Il sync GSC non cancella i profili manuali. Il `contextPrompt` generato è usabile dalla pipeline citation enriched. |

**Alla fine della Fase E**: aggiorna `CLAUDE.md`, `CHANGELOG.md`, `docs/product-state.md`, `docs/user-guide.md` (sezione Audience aggiornata con personas manuali).

---

## Come iniziare una sessione Claude Code

Copia questo prompt all'inizio di ogni sessione:

```
Leggi questi file prima di fare qualsiasi cosa:
1. CLAUDE.md — convezioni, stato attuale, primitivi condivisi
2. docs/v2-implementation-plan.md — piano di implementazione v2
3. docs/v2-specs-ux-architecture.md — specifiche complete v2

Siamo alla Fase [X], Task [Y]. 
Implementa SOLO questo task. 
Verifica che funzioni. 
Commit. 
Aggiorna CLAUDE.md. 
Mostrami cosa hai fatto.
```

Se è la prima sessione di una nuova fase, aggiungi:

```
Prima di iniziare, leggi anche:
- docs/product-state.md — per capire cosa esiste
- docs/architectural-decisions.md — per rispettare i vincoli

Crea il branch feature/v2-fase-[X] da dev.
```

---

## Quando fermare Claude Code

Ferma Claude Code e intervieni manualmente quando:

- **Serve configurazione infrastruttura**: setup Vercel, configurazione Ploi, DNS, OAuth redirect URI. Claude Code non ha accesso a questi pannelli.
- **Serve un test manuale end-to-end**: smoke test su staging, test OAuth GSC, verifica email.
- **Claude Code propone un approccio diverso dalle specifiche**: fermalo, valuta, e ri-allinea se necessario.
- **Un task fallisce i check di verifica dopo 2 tentativi**: probabilmente c'è un problema architetturale, non un bug. Fermati e ragiona.

---

## File da aggiungere al repository

Questo piano prevede 2 nuovi file nella directory `docs/`:

1. `docs/v2-implementation-plan.md` — questo file
2. `docs/v2-specs-ux-architecture.md` — le specifiche UX e architettura (il documento che hai già scaricato)

Aggiungili al repository PRIMA di iniziare qualsiasi task con Claude Code.
