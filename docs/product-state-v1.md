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
- Bug "11 11 gap" fixato (5.7)

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

**Admin panel**
- Lista utenti, gestione ruoli, seed superadmin

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
- **`useJobPolling`** (`hooks/use-job-polling.ts`): polling loop standardizzato. Accetta `onDone` override. Sempre `router.refresh()` dopo creazione job.
- **`SearchableSelect`** (`components/ui/searchable-select.tsx`): combobox con live filter, no deps extra.

### 2.4 Job types nel DB

```
'preview_analysis'    → micro-analisi dalla landing
'discovery'           → Brave + Gemini classificazione
'fetch_content'       → crawl + segmentazione
'full_analysis'       → pipeline completa scoring
'citation_check'      → Gemini Grounding per query
'competitor_analysis' → analisi pagina competitor
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
| `competitors` | competitor rilevati/manuali |
| `competitor_contents` | pagine analizzate dei competitor |
| `recommendations` | raccomandazioni con status |
| `jobs` | job queue asincrona |
| `notifications` | notifiche in-app |

---

## 3. Cosa funziona bene (non toccare)

- Il polling pattern `useJobPolling` + `router.refresh()`: non va sostituito con WebSocket o SSE — il costo non è giustificato.
- Lo scoring euristico sui passaggi: deterministico, senza LLM, ~$0.002 per analisi. Non va convertito a LLM-based.
- La citation verification via Gemini Grounding: l'unica fonte ufficiale per citazioni Google strutturate. Non sostituire con scraping.
- Il competitor analysis automatico dai citation checks: il differenziatore principale del prodotto.
- Il limite di 15 query target: computazionalmente motivato (vedi commercial-strategy.md § 4.3).
- `StepLoader` e `useJobPolling` come standard per tutti i job.

---

## 4. Limitazioni note e debito tecnico

### 4.1 Limitazioni prodotto

- **Solo Google AI Mode / AI Overviews**: nessun supporto ChatGPT/Perplexity (no API equivalenti disponibili). Nella roadmap v2.
- **No rate limiting implementato**: il microservizio Python non ha rate limiting per utente.
- **No piani/billing**: nessun sistema di abbonamento implementato. Le regole dei piani (es. max 5 query free) sono applicate a livello di codice ma non c'è billing reale.
- **No multi-user per progetto**: i progetti appartengono a un singolo utente. Sharing/team non implementato.
- **No export CSV**: nella roadmap commerciale ma non implementato.
- **No white-label**: nella roadmap Agency tier ma non implementato.
- **No scheduled citation checks automatici**: la citation simulation viene triggerata manualmente. Il "weekly automatic" del user guide è aspiration, non implementato.
- **No Share of Model tracking**: nella roadmap v2.

### 4.2 Debito tecnico

- Il `Job` model non ha una priority queue: i job vengono processati in ordine di creazione, non per urgenza.
- `rawHtml` salvato su DB per ogni contenuto: può diventare un problema di storage con molti contenuti.
- `llmReasoning` in `PassageScore`: campo testo libero — non strutturato, difficile da indicizzare o aggregare.
- Lo schema `Competitor` non ha sub-score separati come i `Content`: solo `avgPassageScore`. Un competitor analysis completo produrrebbe i 5 sub-score ma non c'è dove salvarli strutturalmente.
- I `FanoutQuery` vengono rigenerati ad ogni analisi (`batchId` per tracciare il batch), ma i vecchi non vengono eliminati — crescita indefinita della tabella.

---

## 5. Perché alcune cose non sono state fatte

| Cosa | Perché no |
|---|---|
| LLM scoring passaggi | Costo ($30/analisi) + non deterministico |
| WebSocket per job progress | Overkill — polling + router.refresh() è sufficiente |
| URL prefix per i18n | Scelta architetturale: routes sempre in inglese, lingua da cookie |
| Scraping ChatGPT/Perplexity | ToS violation + inaffidabile |
| Auto-scheduling citation checks | Non ancora implementato (infra non pronta) |
| Dashboard analytics usage | Non priorità v1 |
| Multi-tenant / team | Non in scope v1 |
