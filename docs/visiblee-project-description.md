# Visiblee — Project Description

## Nome del progetto
**Visiblee**

## Tagline
AI Visibility Platform — Analizza, ottimizza e monitora la visibilità dei tuoi contenuti nelle risposte di Google AI Mode, AI Overview e LLM.

## Descrizione
Visiblee è una web app SaaS che aiuta brand, creator e professionisti a migliorare la propria visibilità nel nuovo ecosistema di ricerca AI-based. La piattaforma analizza i contenuti digitali indicizzati dell'utente, costruisce un profilo di "AI Readiness" basato sui meccanismi documentati nei patent di Google (query fan-out, pairwise ranking, custom corpus, user embeddings), e guida l'utente nella creazione e ottimizzazione dei contenuti per massimizzare le probabilità di essere citato dagli LLM nelle loro risposte.

## Target Users
- Professionisti e personal brand che vogliono essere citati come esperti nelle risposte AI
- Piccole e medie imprese che dipendono dalla visibilità organica
- Agenzie SEO/marketing che vogliono offrire servizi di Generative Engine Optimization (GEO)
- Content creator con presenza multi-piattaforma

## Problema che risolve
Google AI Mode, AI Overviews e le risposte conversazionali di LLM come ChatGPT, Perplexity e Gemini stanno sostituendo i classici "10 link blu" con risposte sintetiche generate dall'AI. Per brand e professionisti, la sfida non è più "posizionarsi in prima pagina" ma essere citati e referenziati dalle AI nelle loro risposte. Attualmente non esistono strumenti accessibili che permettano di analizzare sistematicamente i propri contenuti rispetto a questi meccanismi.

## Core Value Proposition
1. **Scopri cosa Google AI vede di te** — Content discovery basato sull'indice reale di Google (via Brave Search API)
2. **Misura la tua AI Readiness** — 5 score oggettivi basati sui meccanismi dei patent Google
3. **Sappi esattamente cosa fare** — Raccomandazioni prioritizzate con stima di impatto
4. **Monitora i progressi** — Storico settimanale degli score con trend
5. **Benchmark vs competitor** — Confronto con chi appare effettivamente nelle risposte AI per le tue query

---

## Internazionalizzazione (i18n)

### Lingue supportate
L'app è disponibile in **italiano** e **inglese**. La lingua viene rilevata automaticamente dalle preferenze del browser dell'utente (header `Accept-Language`). Nel sito pubblico (marketing), un selettore lingua è disponibile nel footer. Nell'area autenticata, l'utente può cambiare lingua dalla pagina Settings dell'account.

### Principi di implementazione
- **Nessun prefisso lingua nel routing**: le route restano invariate (es. `/app/projects/[id]/overview`, non `/it/app/...` o `/en/app/...`). La lingua è determinata lato client/server dalle preferenze browser, non dall'URL.
- **Routing in inglese**: tutti i segmenti delle URL sono in inglese indipendentemente dalla lingua dell'interfaccia.
- **Libreria**: `next-intl` (integrato con Next.js App Router, supporta RSC, middleware per detection lingua).
- **Struttura file traduzioni**: `messages/it.json` e `messages/en.json` nella root del progetto Next.js.
- **Scope**: tutta l'app (marketing, auth, app autenticata, admin) è tradotta. I contenuti generati dall'AI (insight, raccomandazioni) vengono generati nella lingua dell'utente tramite parametro `language` nei prompt LLM.
- **Fallback**: se la lingua del browser non è né italiano né inglese, il fallback è l'inglese.
- **Persistenza**: la preferenza lingua viene salvata in un cookie (`NEXT_LOCALE`) così resta stabile tra sessioni senza modificare l'URL.

---

## Funnel di acquisizione utente

### Landing page (visiblee.ai)
L'utente arriva su una landing page essenziale. Il form è above the fold — non deve scrollare per trovarlo. Inserisce URL del sito, nome brand e 3 query target. CTA: "Ottieni il tuo AI Score". Nessuna registrazione richiesta per avviare l'analisi.

### Micro-analisi e preview
Il sistema esegue un'analisi rapida (30-60 secondi) e mostra il risultato su una pagina pubblica con URL condivisibile (`/preview/[id]`). L'utente vede: AI Readiness Score, radar dei 5 sotto-score, 3-4 insight concreti. I contenuti dettagliati (lista contenuti, raccomandazioni, dettaglio passaggi) sono blurred/locked.

### Conversione
Due CTA: "Ricevi il report via email" (richiede inserimento email, invia PDF via email) e "Registrati per l'analisi completa" (CTA principale). L'email del report e la registrazione sono i due punti di conversione. L'email raccolta con il report è un lead qualificato utilizzabile per future comunicazioni e nurturing.

### Post-registrazione
L'utente si registra (Google OAuth o email/password). Il sistema associa automaticamente la preview al nuovo utente, crea il primo progetto con i dati già inseriti (zero data re-entry), e lo porta nella dashboard del progetto. L'analisi approfondita gira in background. Se l'utente aveva già inserito la sua email per il report, il form di registrazione la pre-compila.

### Google Analytics
GA4 traccia il funnel di acquisizione nel sito pubblico: page_view → form_start → analysis_requested → preview_viewed → report_requested → registration_started → registration_completed. GA NON è presente nell'area loggata — lì le azioni vengono tracciate internamente nel database.

---

## Struttura della web app

### Sito pubblico (marketing)
Landing page, pagina preview, pagine informative (pricing futuro, about, blog futuro). Layout proprio con navbar pubblica e footer. Accessibile senza autenticazione.

### Area autenticata (app)
Dashboard multi-progetto, gestione progetti con tutte le funzionalità di analisi, scoring, raccomandazioni, agente AI. Layout con sidebar contestuale. Richiede login.

### Pannello admin (superadmin)
Gestione utenti, vista progetti utente in read-only, monitoraggio job. Accessibile solo a utenti con ruolo superadmin.

### Architettura delle route
Tutto vive nello stesso repo Next.js, separato tramite route groups:
- `(marketing)/` — sito pubblico con layout marketing (navbar pubblica, footer, GA)
- `(auth)/` — login e registrazione
- `(app)/` — area autenticata con layout app (sidebar, richiede auth)
- `(admin)/` — pannello superadmin

Le route sono sempre in inglese. La lingua dell'interfaccia è determinata dal browser, non dall'URL.

---

## Nomenclatura score (user-facing)

I nomi tecnici usati nel codice e nel database restano invariati (es. `fanout_coverage_score`). Nell'interfaccia utente, gli score vengono presentati con nomi più comprensibili:

| Nome tecnico (codice/DB) | Nome UI | Descrizione breve per l'utente |
|---|---|---|
| `ai_readiness_score` | **AI Readiness Score** | Il punteggio complessivo di visibilità AI |
| `fanout_coverage_score` | **Query Reach** | Quante domande correlate trovano risposta nei tuoi contenuti |
| `passage_quality_score` | **Answer Strength** | Quanto ogni paragrafo è forte e competitivo |
| `chunkability_score` | **Extractability** | Quanto è facile per l'AI estrarre informazioni |
| `entity_coherence_score` | **Brand Trust** | Quanto il tuo brand è riconoscibile e coerente |
| `cross_platform_score` | **Source Authority** | Quanto sei presente su fonti diverse e autorevoli |

### Sezioni dell'app (sidebar progetto)

| Route | Nome sidebar | Descrizione |
|---|---|---|
| `/overview` | **Overview** | Punteggio e trend |
| `/queries` | **Queries** | Le ricerche che vuoi presidiare |
| `/contents` | **Contents** | Tutto ciò che l'AI può trovare di te |
| `/opportunities` | **Opportunity Map** | Dove puoi migliorare |
| `/competitors` | **Competitors** | Chi appare al posto tuo |
| `/optimization` | **Optimization Tips** | Cosa fare, in ordine di priorità |
| `/agent` | **GEO Expert** | Assistente AI per migliorare i contenuti |
| `/settings` | **Settings** | Impostazioni progetto |

### Wizard e onboarding educativi

L'app è pensata per un target informato ma non necessariamente tecnico. Per rendere accessibili i concetti di AI search:

- **Onboarding tour**: al primo accesso, un wizard a 4 step illustrato che spiega "come l'AI decide chi citare" (domanda → fan-out → selezione passaggi → risposta). Skippabile e rivedibile dalle impostazioni.
- **Pannelli "Come funziona?"**: icona `?` accanto a ogni score. Apre un pannello laterale con spiegazione in linguaggio semplice + esempio concreto. Es: "Query Reach — Quando cerchi qualcosa, l'AI non usa solo la tua domanda: genera decine di domande correlate. Questo punteggio misura quante di quelle domande trovano risposta nei tuoi contenuti."
- **Tooltip contestuali**: sui sotto-criteri (es. Self-containedness → "Il paragrafo ha senso anche da solo?")
- **Empty state educativi**: quando una sezione non ha ancora dati, mostra una spiegazione di cosa verrà mostrato e perché è utile, invece di una pagina vuota.

---

## Istruzioni per Claude

### Ruolo
Claude agisce come **Project Architect** per Visiblee. Il suo compito è ragionare sull'architettura tecnica dettagliata, produrre specifiche per Claude Code, e guidare lo sviluppo incrementale della web app.

### Principi di sviluppo
- **Sviluppo atomico**: ogni task è circoscritto e completabile in isolamento
- **Commit atomici**: ogni commit = una singola unità logica di lavoro
- **Test prima di procedere**: ogni step verificato funzionante prima del successivo
- **Documentazione continua**: CLAUDE.md aggiornato dopo ogni step completato

### Stack tecnologico confermato
- **Frontend**: Next.js 14+ (App Router) + shadcn/ui + Tailwind CSS
- **i18n**: next-intl (italiano + inglese, detection da browser, no prefisso lingua nel routing)
- **Backend**: Monorepo Next.js (API Routes) + Python microservice (analisi AI, scoring)
- **Auth**: NextAuth.js (Auth.js v5) — Google OAuth + email/password
- **Database**: PostgreSQL + pgvector
- **ORM**: Prisma
- **LLM Integration**: Multi-provider per funzione (Gemini per fan-out, Claude Sonnet per quality judging, Haiku per classificazione)
- **Embedding**: Voyage AI (voyage-3-large) o OpenAI (text-embedding-3-small)
- **Search API**: Brave Search API
- **Email transazionale**: MailerSend (invio report PDF via email)
- **Analytics**: Google Analytics 4 (solo sito pubblico)
- **Hosting produzione**: Vercel (frontend), Hetzner via Ploi (backend Python + DB su server separati)

### Infrastruttura disponibile
- **Vercel**: deploy automatico frontend Next.js
- **Hetzner server 1**: PostgreSQL + pgvector (database dedicato)
- **Hetzner server 2**: Python microservice FastAPI (compute dedicato)
- **Ploi**: gestione di entrambi i server Hetzner (deploy, SSL, backup DB, monitoring)

### Vincoli di progetto
- Sviluppo iniziale in locale
- Minimizzare il numero di servizi esterni in produzione
- Il prodotto parte Free (pricing da aggiungere in futuro)
- Super admin con pannello di controllo su tutti gli utenti e progetti
- Multi-progetto: ogni utente può avere più progetti
- Solo contenuti indicizzati dai motori di ricerca vengono considerati (se Google non lo vede, AI Mode non può citarlo)
- App bilingue (IT/EN) con detection automatica da browser, route sempre in inglese

### Contesto dei documenti di riferimento
Questo progetto include due documenti fondamentali:
1. **visiblee-theory.md** — Il documento teorico che spiega i meccanismi di Google AI Mode, i patent, la letteratura di supporto, e la logica degli score
2. **visiblee-specs.md** — Le specifiche tecniche dettagliate: architettura, database schema, API, UX flow, implementazione degli score

Claude deve sempre consultare questi documenti prima di prendere decisioni architetturali o implementative.

### Fonti esterne di riferimento
- iPullRank — "How AI Mode Works": https://ipullrank.com/how-ai-mode-works
- WordLift — "Query Fan-Out: A Data-Driven Approach": https://wordlift.io/blog/en/query-fan-out-ai-search/
- Paper GEO (KDD 2024): https://arxiv.org/pdf/2311.09735
- WordLift — "Why AI Cites Some Pages and Ignores Others": https://wordlift.io/blog/en/embeddings-search-visibility/
