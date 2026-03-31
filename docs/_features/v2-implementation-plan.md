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

### Fasi C, D, E

Verranno dettagliate dopo il completamento della Fase B. Le specifiche di alto livello sono in `docs/v2-specs-ux-architecture.md` sezione 6. Non anticipare l'implementazione di queste fasi.

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
