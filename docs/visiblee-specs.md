# Visiblee — Specifiche Tecniche

---

## 1. Architettura di sistema

### 1.1 Overview

Visiblee è un monorepo con due componenti principali:

1. **Next.js App** (frontend + API routes): gestisce UI (sito marketing + app + admin), autenticazione, CRUD, orchestrazione, i18n
2. **Python Microservice**: gestisce analisi AI, scoring, embedding, content processing

I due componenti comunicano via API REST interne. In locale girano entrambi. In produzione: Next.js su Vercel, Python su Hetzner server dedicato (gestito da Ploi), DB su Hetzner server separato (gestito da Ploi).

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND                          │
│              Next.js 14+ (App Router)                │
│            shadcn/ui + Tailwind CSS                  │
│               next-intl (IT/EN)                      │
│                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │Marketing │ │   App    │ │  Admin   │            │
│  │ (public) │ │(auth req)│ │(superadm)│            │
│  │ + GA4    │ │          │ │          │            │
│  └──────────┘ └──────────┘ └──────────┘            │
└────────────────────┬────────────────────────────────┘
                     │ API Routes (Next.js)
                     │ - Auth (NextAuth v5)
                     │ - CRUD (projects, content, queries)
                     │ - Preview analysis
                     │ - Orchestrazione job
                     │ - Email transazionali (MailerSend)
                     ▼
┌─────────────────────────────────────────────────────┐
│                   DATABASE                           │
│               PostgreSQL + pgvector                  │
│           (Hetzner server dedicato)                  │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│              PYTHON MICROSERVICE                     │
│                  FastAPI                              │
│           (Hetzner server dedicato)                  │
│                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ Content  │ │  Scoring │ │  Fan-Out │            │
│  │ Fetcher  │ │  Engine  │ │Simulator │            │
│  └──────────┘ └──────────┘ └──────────┘            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │Embedding │ │  LLM     │ │  Recomm  │            │
│  │ Service  │ │  Judge   │ │  Engine  │            │
│  └──────────┘ └──────────┘ └──────────┘            │
└─────────────────────────────────────────────────────┘
```

### 1.2 Stack tecnologico dettagliato

| Layer | Tecnologia | Motivazione |
|-------|-----------|-------------|
| Frontend | Next.js 14+ (App Router) | SSR, RSC, routing nativo, deploy Vercel |
| UI Components | shadcn/ui + Tailwind CSS | Componenti accessibili, personalizzabili, no vendor lock-in |
| i18n | next-intl | Supporto RSC, middleware per detection lingua, no prefisso URL |
| Auth | Auth.js v5 (NextAuth) | Google OAuth + Credentials, session JWT |
| Database | PostgreSQL + pgvector | Relazionale + vector search nativo, self-hostable |
| ORM | Prisma | Type-safe, migrations, ottimo con Next.js |
| Python API | FastAPI | Async, type hints, auto-docs, performante |
| Job Queue | pg-boss (Node) o polling su tabella jobs | Minimizza servizi esterni (no Redis/RabbitMQ necessario) |
| Search API | Brave Search API | Content discovery, verifica indicizzazione, gratuito per MVP |
| Email | MailerSend | Email transazionali (invio report PDF), account esistente, API REST |
| Embedding | Voyage AI (voyage-3-large) o OpenAI (text-embedding-3-small) | Costo/performance ottimale per calcolo similarità |
| LLM — Fan-Out | Google Gemini 2.0 Flash | È il modello che Google usa internamente; coerenza massima con il meccanismo reale, costo basso |
| LLM — Quality Judge | Claude Sonnet 4 | Migliore per valutazioni qualitative strutturate e reasoning |
| LLM — Recommendations | Claude Sonnet 4 | Generazione raccomandazioni e contenuti di alta qualità |
| LLM — Classification | Claude Haiku o Gemini Flash | Classificazione veloce (filtro contenuti discovery), costo minimo |
| Content Fetching | Playwright (headless) o Jina Reader API | Estrazione testo pulito da URL web |
| Analytics | Google Analytics 4 | Solo sito marketing/pubblico, tracking funnel acquisizione |
| PDF Generation | @react-pdf/renderer o puppeteer | Report preview inviato via email |

### 1.3 Scelta LLM per funzione — Razionale

**Gemini per il Fan-Out Simulation**: Google usa Gemini internamente per il query fan-out. Usando lo stesso modello, le query sintetiche generate saranno più coerenti con quelle che Google genererebbe realmente. Gemini 2.0 Flash ha un costo molto basso (~$0.10/1M input tokens) ed è veloce.

**Claude Sonnet per il Quality Judging**: la valutazione della qualità dei passaggi richiede reasoning strutturato e coerente. Claude Sonnet eccelle nel seguire rubric complesse con output consistenti. Il patent US20250124067A1 descrive un LLM che "ragiona" sulla rilevanza — Claude è il modello migliore per replicare questo tipo di valutazione.

**Claude Haiku per la classificazione**: il filtro dei contenuti nella discovery (pertinente/non pertinente) è un task semplice che richiede velocità e costo minimo. Haiku è ideale.

**Embedding**: Voyage AI voyage-3-large offre il miglior rapporto qualità/prezzo per embedding di testo lungo. In alternativa, OpenAI text-embedding-3-small è più economico ma leggermente meno performante su testi in lingue diverse dall'inglese. Per un prodotto che serve anche il mercato italiano, Voyage AI è preferibile.

### 1.4 Infrastruttura di produzione

```
┌─────────────┐     ┌──────────────────────────────────────────────┐
│   Vercel     │     │              Hetzner (via Ploi)              │
│              │     │                                              │
│  Next.js App │     │  ┌─────────────────────────────────────┐    │
│  (frontend + │────▶│  │  Server 1: PostgreSQL + pgvector    │    │
│   API routes)│     │  │  (database dedicato)                │    │
│              │     │  └─────────────────────────────────────┘    │
│              │     │  ┌─────────────────────────────────────┐    │
│              │────▶│  │  Server 2: Python Microservice      │    │
│              │     │  │  (FastAPI — compute dedicato)       │    │
│              │     │  └─────────────────────────────────────┘    │
└─────────────┘     └──────────────────────────────────────────────┘
```

**Vercel**: deploy automatico del frontend Next.js. Le API routes di Next.js gestiscono auth, CRUD, email e orchestrazione (chiamano il Python microservice).

**Hetzner Server 1 — Database** (gestito da Ploi): server dedicato che ospita PostgreSQL con pgvector. Ploi gestisce backup automatici, SSL, monitoring. Il database è isolato dal carico computazionale dell'analisi AI.

**Hetzner Server 2 — Compute** (gestito da Ploi): server dedicato che ospita il Python microservice FastAPI. Gestisce le operazioni intensive: analisi AI, scoring, embedding, content processing. Può essere scalato indipendentemente dal database.

**Comunicazione**: le API routes Next.js su Vercel chiamano il Python microservice su Hetzner via HTTPS. Il microservice è protetto da API key interna (non esposto pubblicamente). Il microservice si connette al DB su Server 1 via rete interna Hetzner.

---

## 2. Database Schema

### 2.1 Schema principale (PostgreSQL + pgvector)

```sql
-- Estensione per vector search
CREATE EXTENSION IF NOT EXISTS vector;

-- =============================================
-- UTENTI E AUTENTICAZIONE
-- =============================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    avatar_url TEXT,
    hashed_password TEXT, -- NULL se login solo via OAuth
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'superadmin')),
    preferred_locale VARCHAR(5) DEFAULT 'en', -- 'it' o 'en', sincronizzato dal cookie NEXT_LOCALE alla registrazione
    email_verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabelle NextAuth (accounts, sessions, verification_tokens)
-- Generate automaticamente da Auth.js v5 adapter per Prisma

CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    provider_account_id VARCHAR(255) NOT NULL,
    refresh_token TEXT,
    access_token TEXT,
    expires_at INTEGER,
    token_type VARCHAR(50),
    scope TEXT,
    id_token TEXT,
    UNIQUE(provider, provider_account_id)
);

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_token VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires TIMESTAMPTZ NOT NULL
);

-- =============================================
-- PREVIEW ANALYSES (pre-registrazione)
-- =============================================

CREATE TABLE preview_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Dati inseriti dall'utente (landing page form)
    website_url TEXT NOT NULL,
    brand_name VARCHAR(255) NOT NULL,
    query_targets TEXT[] NOT NULL,
    
    -- Risultati della micro-analisi
    ai_readiness_score FLOAT,
    fanout_coverage_score FLOAT,
    passage_quality_score FLOAT,
    chunkability_score FLOAT,
    entity_coherence_score FLOAT,
    cross_platform_score FLOAT,
    insights JSONB,             -- insight testuali generati per la preview
    contents_found INTEGER,     -- quanti contenuti indicizzati trovati
    analysis_data JSONB,        -- dati completi dell'analisi (per creare il progetto dopo registrazione)
    
    -- Collegamento post-registrazione
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    converted_at TIMESTAMPTZ,
    
    -- Report via email (lead capture)
    report_email VARCHAR(255),      -- email inserita per ricevere il report PDF
    report_sent_at TIMESTAMPTZ,     -- quando è stato inviato il report
    
    -- Tracking (per analytics interne)
    ip_address INET,
    user_agent TEXT,
    referrer TEXT,
    locale VARCHAR(5),              -- lingua dell'utente al momento dell'analisi
    
    -- Stato
    status VARCHAR(20) DEFAULT 'pending' 
        CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'
);

CREATE INDEX idx_preview_status ON preview_analyses(status);
CREATE INDEX idx_preview_user ON preview_analyses(user_id);
CREATE INDEX idx_preview_email ON preview_analyses(report_email);

-- =============================================
-- PROGETTI
-- =============================================

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    brand_name VARCHAR(255) NOT NULL,
    website_url TEXT NOT NULL,
    brand_context TEXT,         -- descrizione brand, settore, posizionamento (può essere inferita da LLM)
    preview_id UUID REFERENCES preview_analyses(id), -- collegamento alla preview che ha generato il progetto
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_projects_user ON projects(user_id);

-- =============================================
-- QUERY TARGET
-- =============================================

CREATE TABLE target_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    query_text TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_target_queries_project ON target_queries(project_id);

-- Query sintetiche generate dal fan-out
CREATE TABLE fanout_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_query_id UUID NOT NULL REFERENCES target_queries(id) ON DELETE CASCADE,
    query_text TEXT NOT NULL,
    query_type VARCHAR(50) NOT NULL, -- 'related', 'implicit', 'comparative', 'exploratory', 'decisional', 'recent'
    embedding vector(1024),
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    batch_id UUID NOT NULL          -- per raggruppare le query generate nello stesso ciclo
);

CREATE INDEX idx_fanout_queries_target ON fanout_queries(target_query_id);
CREATE INDEX idx_fanout_queries_batch ON fanout_queries(batch_id);
CREATE INDEX idx_fanout_embedding ON fanout_queries USING ivfflat (embedding vector_cosine_ops);

-- =============================================
-- CONTENUTI
-- =============================================

CREATE TABLE contents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    title VARCHAR(500),
    platform VARCHAR(50) NOT NULL,      -- 'website', 'linkedin', 'medium', 'substack', 'reddit', 'youtube', 'news', 'other'
    content_type VARCHAR(50) DEFAULT 'own', -- 'own' (contenuto proprio), 'mention' (menzione su sito terzo)
    source VARCHAR(50) DEFAULT 'discovery', -- 'discovery' (trovato automaticamente), 'manual' (aggiunto dall'utente)
    is_indexed BOOLEAN DEFAULT true,    -- trovato nell'indice di ricerca?
    is_confirmed BOOLEAN DEFAULT false, -- confermato dall'utente?
    raw_text TEXT,
    word_count INTEGER,
    last_fetched_at TIMESTAMPTZ,
    last_modified_at TIMESTAMPTZ,
    discovery_confidence FLOAT,         -- confidenza del filtro LLM (0-1)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contents_project ON contents(project_id);
CREATE INDEX idx_contents_platform ON contents(platform);
CREATE UNIQUE INDEX idx_contents_url_project ON contents(url, project_id);

-- Passaggi estratti dai contenuti
CREATE TABLE passages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
    passage_text TEXT NOT NULL,
    passage_index INTEGER NOT NULL,
    word_count INTEGER,
    heading TEXT,                        -- heading della sezione a cui appartiene
    embedding vector(1024),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_passages_content ON passages(content_id);
CREATE INDEX idx_passages_embedding ON passages USING ivfflat (embedding vector_cosine_ops);

-- =============================================
-- COMPETITOR
-- =============================================

CREATE TABLE competitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    website_url TEXT,
    source VARCHAR(50) DEFAULT 'auto',  -- 'auto' (trovato nelle AI Overview), 'manual' (aggiunto dall'utente)
    is_confirmed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_competitors_project ON competitors(project_id);

-- Contenuti dei competitor (analizzati per benchmark)
CREATE TABLE competitor_contents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competitor_id UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    title VARCHAR(500),
    raw_text TEXT,
    found_for_query_id UUID REFERENCES target_queries(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Passaggi dei competitor
CREATE TABLE competitor_passages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competitor_content_id UUID NOT NULL REFERENCES competitor_contents(id) ON DELETE CASCADE,
    passage_text TEXT NOT NULL,
    passage_index INTEGER NOT NULL,
    word_count INTEGER,
    embedding vector(1024),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comp_passages_embedding ON competitor_passages USING ivfflat (embedding vector_cosine_ops);

-- =============================================
-- SCORING
-- =============================================

-- Snapshot settimanale degli score di progetto
CREATE TABLE project_score_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    snapshot_type VARCHAR(20) DEFAULT 'weekly' CHECK (snapshot_type IN ('weekly', 'manual')),
    ai_readiness_score FLOAT NOT NULL,
    fanout_coverage_score FLOAT NOT NULL,
    passage_quality_score FLOAT NOT NULL,
    chunkability_score FLOAT NOT NULL,
    entity_coherence_score FLOAT NOT NULL,
    cross_platform_score FLOAT NOT NULL,
    metadata JSONB,             -- dati aggiuntivi (es: numero query coperte, totale passaggi analizzati)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_score_snapshots_project ON project_score_snapshots(project_id, created_at DESC);

-- Score individuali per contenuto
CREATE TABLE content_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
    snapshot_id UUID NOT NULL REFERENCES project_score_snapshots(id) ON DELETE CASCADE,
    overall_score FLOAT NOT NULL,
    passage_quality_score FLOAT,
    chunkability_score FLOAT,
    fanout_coverage_score FLOAT,
    weakest_passage_id UUID REFERENCES passages(id),
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_content_scores_content ON content_scores(content_id);
CREATE INDEX idx_content_scores_snapshot ON content_scores(snapshot_id);

-- Score individuali per passaggio
CREATE TABLE passage_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    passage_id UUID NOT NULL REFERENCES passages(id) ON DELETE CASCADE,
    snapshot_id UUID NOT NULL REFERENCES project_score_snapshots(id) ON DELETE CASCADE,
    self_containedness FLOAT,
    claim_clarity FLOAT,
    information_density FLOAT,
    completeness FLOAT,
    verifiability FLOAT,
    overall_score FLOAT,
    llm_reasoning TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_passage_scores_passage ON passage_scores(passage_id);
CREATE INDEX idx_passage_scores_snapshot ON passage_scores(snapshot_id);

-- Fan-out coverage mapping
CREATE TABLE fanout_coverage_map (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fanout_query_id UUID NOT NULL REFERENCES fanout_queries(id) ON DELETE CASCADE,
    passage_id UUID NOT NULL REFERENCES passages(id) ON DELETE CASCADE,
    similarity_score FLOAT NOT NULL,
    is_covered BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fanout_coverage_query ON fanout_coverage_map(fanout_query_id);
CREATE INDEX idx_fanout_coverage_passage ON fanout_coverage_map(passage_id);

-- =============================================
-- RACCOMANDAZIONI
-- =============================================

CREATE TABLE recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    content_id UUID REFERENCES contents(id) ON DELETE SET NULL,
    passage_id UUID REFERENCES passages(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL,          -- 'quick_win', 'content_gap', 'platform_opportunity'
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
    effort VARCHAR(20) CHECK (effort IN ('quick', 'moderate', 'significant')),
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    suggested_action TEXT,
    estimated_impact FLOAT,
    target_score VARCHAR(50),           -- quale sotto-score migliora
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'dismissed')),
    snapshot_id UUID REFERENCES project_score_snapshots(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_recommendations_project ON recommendations(project_id, status);
CREATE INDEX idx_recommendations_content ON recommendations(content_id);

-- =============================================
-- JOB QUEUE
-- =============================================

CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE, -- NULL per job di preview
    preview_id UUID REFERENCES preview_analyses(id) ON DELETE CASCADE, -- per job di preview pre-registrazione
    type VARCHAR(50) NOT NULL,          -- 'preview_analysis', 'discovery', 'fetch_content', 'generate_fanout', 'compute_embeddings', 'score_passages', 'score_project', 'generate_recommendations', 'send_report_email'
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    payload JSONB,
    result JSONB,
    error TEXT,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_jobs_status ON jobs(status, created_at);
CREATE INDEX idx_jobs_project ON jobs(project_id);
CREATE INDEX idx_jobs_preview ON jobs(preview_id);

-- =============================================
-- NOTIFICHE
-- =============================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,          -- 'analysis_complete', 'score_change', 'new_recommendations', 'system'
    title VARCHAR(255) NOT NULL,
    message TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
```

### 2.2 Note sullo schema

**pgvector**: la dimensione del vettore (1024) è impostata per Voyage AI voyage-3-large. Se si usa OpenAI text-embedding-3-small, è 1536. Questo va parametrizzato nella configurazione.

**Job queue**: si usa una semplice tabella `jobs` con polling dal Python microservice. I job possono essere collegati a un `project_id` (post-registrazione) o a un `preview_id` (pre-registrazione). Il tipo `send_report_email` gestisce l'invio asincrono del report PDF via MailerSend. Per l'MVP questo è sufficiente e non richiede servizi esterni.

**preview_analyses**: i record hanno un TTL di 30 giorni. Un job periodico o un trigger DB elimina le preview scadute non convertite. Quando l'utente si registra, il campo `analysis_data` (JSONB) contiene tutti i dati necessari per creare il progetto senza rieseguire l'analisi. Il campo `report_email` cattura l'email del lead prima della registrazione — se l'utente si registra successivamente, il form può essere pre-compilato con questa email.

**JSONB fields**: i campi `metadata`, `details`, `payload`, `result`, `insights`, `analysis_data` usano JSONB per flessibilità. Permettono di salvare dati strutturati che possono evolvere senza migrazioni di schema.

**i18n**: il campo `preferred_locale` nella tabella `users` viene sincronizzato dalla preferenza browser al momento della registrazione. Serve come riferimento per l'invio di email nella lingua corretta e per la generazione di contenuti AI (insight, raccomandazioni) nella lingua dell'utente. La tabella `preview_analyses` ha un campo `locale` per generare il report PDF nella lingua giusta.

---

## 3. API Design

### 3.1 Next.js API Routes (orchestrazione e CRUD)

```
# Auth
POST   /api/auth/[...nextauth]     # Auth.js v5 handler

# Preview (no auth — landing page)
POST   /api/preview/analyze         # Avvia micro-analisi dalla landing page
GET    /api/preview/[id]            # Stato e risultati della preview
POST   /api/preview/[id]/send-report # Genera PDF e invia via email (body: { email })
POST   /api/preview/[id]/convert    # Converte preview in progetto (richiede auth)

# Users (superadmin only)
GET    /api/admin/users             # Lista utenti
GET    /api/admin/users/[id]        # Dettaglio utente
PATCH  /api/admin/users/[id]        # Modifica utente (ruolo, stato)
GET    /api/admin/users/[id]/projects # Progetti dell'utente (customer success)

# Projects
GET    /api/projects                # Lista progetti dell'utente corrente
POST   /api/projects                # Crea progetto
GET    /api/projects/[id]           # Dettaglio progetto
PATCH  /api/projects/[id]           # Modifica progetto
DELETE /api/projects/[id]           # Elimina progetto

# Target Queries
GET    /api/projects/[id]/queries            # Lista query target
POST   /api/projects/[id]/queries            # Aggiungi query target
DELETE /api/projects/[id]/queries/[queryId]  # Rimuovi query target

# Contents
GET    /api/projects/[id]/contents           # Lista contenuti (filtri: platform, score, status)
POST   /api/projects/[id]/contents           # Aggiungi contenuto manuale
PATCH  /api/projects/[id]/contents/[cId]     # Conferma/scarta contenuto
DELETE /api/projects/[id]/contents/[cId]     # Rimuovi contenuto

# Competitors
GET    /api/projects/[id]/competitors        # Lista competitor
POST   /api/projects/[id]/competitors        # Aggiungi competitor manuale
PATCH  /api/projects/[id]/competitors/[cId]  # Conferma/scarta
DELETE /api/projects/[id]/competitors/[cId]  # Rimuovi

# Scores
GET    /api/projects/[id]/scores             # Score correnti + storico
GET    /api/projects/[id]/scores/latest      # Ultimo snapshot
GET    /api/projects/[id]/contents/[cId]/scores  # Score di un contenuto specifico

# Recommendations
GET    /api/projects/[id]/recommendations    # Lista raccomandazioni (filtri: type, priority, status)
PATCH  /api/projects/[id]/recommendations/[rId]  # Cambia stato raccomandazione

# Fan-Out
GET    /api/projects/[id]/fanout             # Query fan-out attuali con copertura
GET    /api/projects/[id]/fanout/[queryId]   # Fan-out per una query specifica

# Actions (trigger job)
POST   /api/projects/[id]/actions/discovery      # Lancia content discovery
POST   /api/projects/[id]/actions/analyze         # Lancia analisi completa
POST   /api/projects/[id]/actions/analyze-content # Ri-analizza un singolo contenuto

# Notifications
GET    /api/notifications                   # Notifiche dell'utente
PATCH  /api/notifications/[id]/read         # Segna come letta
```

### 3.2 Python Microservice API (FastAPI)

```
# Content Processing
POST   /api/v1/fetch-content          # Scarica e estrai testo da URL
POST   /api/v1/chunk-content          # Segmenta testo in passaggi

# Embedding
POST   /api/v1/embed                  # Genera embedding per testi

# Fan-Out
POST   /api/v1/generate-fanout       # Genera query sintetiche per una query target
POST   /api/v1/compute-coverage      # Calcola copertura fan-out (cosine similarity)

# Scoring
POST   /api/v1/score-passages        # Valuta qualità passaggi (LLM judge)
POST   /api/v1/score-chunkability    # Calcola chunkability (euristico)
POST   /api/v1/score-entity-coherence # Calcola coerenza entità
POST   /api/v1/score-cross-platform  # Calcola segnali cross-platform

# Classification
POST   /api/v1/classify-content      # Classifica pertinenza contenuto (filtro discovery)

# Recommendations
POST   /api/v1/generate-recommendations  # Genera raccomandazioni per un progetto

# Discovery
POST   /api/v1/discover-content      # Cerca contenuti indicizzati via Brave Search API

# Preview (analisi rapida per landing page)
POST   /api/v1/preview-analyze       # Analisi rapida: crawl + fan-out base + scoring veloce

# Health
GET    /api/v1/health                 # Health check
```

**Nota**: tutti gli endpoint del microservice che generano testo (insight, raccomandazioni, reasoning) accettano un parametro `language` (default: `"en"`) per generare i contenuti nella lingua dell'utente. Il parametro viene passato dalle API routes Next.js in base alla preferenza lingua corrente.

### 3.3 Autenticazione tra i servizi

Il Python microservice è protetto da una API key interna (`X-Internal-API-Key` header). Solo le API routes di Next.js possono chiamarlo. In produzione, il microservice su Hetzner Server 2 non è esposto su un dominio pubblico — è raggiungibile solo dall'IP di Vercel o via rete privata Hetzner.

---

## 4. UX Architecture

### 4.1 Mappa delle pagine

```
# ===== SITO MARKETING (pubblico) =====
/ ......................................... Landing page con form analisi
/preview/[id] ............................. Risultato micro-analisi (pubblica, condivisibile)
/pricing .................................. Pagina pricing (futura)
/about .................................... Chi siamo (futura)
/blog ..................................... Blog (futuro, SEO)

# ===== AUTENTICAZIONE =====
/login .................................... Login (Google OAuth + email)
/register ................................. Registrazione email

# ===== APP (richiede auth) =====
/app ...................................... Dashboard globale (listing progetti)
/app/projects/new ......................... Wizard creazione progetto
/app/projects/[id] ........................ Redirect a overview progetto
/app/projects/[id]/overview ............... Overview progetto (score + trend)
/app/projects/[id]/queries ................ Gestione query target + fan-out
/app/projects/[id]/contents ............... Inventario contenuti
/app/projects/[id]/contents/[cId] ......... Dettaglio contenuto + score passaggi
/app/projects/[id]/opportunities .......... Opportunity Map (gap & opportunità)
/app/projects/[id]/competitors ............ Benchmark competitor
/app/projects/[id]/optimization ........... Optimization Tips (raccomandazioni)
/app/projects/[id]/agent .................. GEO Expert (agente AI conversazionale)
/app/projects/[id]/settings ............... Impostazioni progetto

/app/settings ............................. Impostazioni account utente
/app/notifications ........................ Centro notifiche

# ===== ADMIN (superadmin only) =====
/admin .................................... Dashboard admin
/admin/users .............................. Lista utenti
/admin/users/[id] ......................... Dettaglio utente + suoi progetti
/admin/users/[id]/projects/[pId] .......... Vista progetto utente (read-only)
```

**Nota**: tutte le route sono in inglese. La lingua dell'interfaccia (testi, label, messaggi) è determinata dalla preferenza del browser, non dall'URL. Il cambio lingua avviene tramite selettore nell'interfaccia senza modificare l'URL.

### 4.2 Layout e navigazione

#### Route groups in Next.js App Router
```
app/
├── (marketing)/              # Sito pubblico
│   ├── layout.tsx            # Navbar pubblica + footer (con selettore lingua) + GA4 script
│   ├── page.tsx              # Landing page (/)
│   ├── preview/
│   │   └── [id]/
│   │       └── page.tsx      # Risultato preview
│   ├── pricing/
│   │   └── page.tsx          # Pricing (futuro)
│   └── about/
│       └── page.tsx          # About (futuro)
├── (auth)/                   # Login/Register
│   ├── layout.tsx            # Layout centrato, minimale
│   ├── login/
│   │   └── page.tsx
│   └── register/
│       └── page.tsx
├── (app)/                    # Area autenticata
│   ├── layout.tsx            # Shell app: sidebar + navbar
│   ├── app/
│   │   └── page.tsx          # Dashboard globale
│   └── projects/
│       ├── new/
│       │   └── page.tsx      # Wizard creazione progetto
│       └── [id]/
│           ├── layout.tsx    # Sidebar contestuale progetto
│           ├── overview/
│           ├── queries/
│           ├── contents/
│           │   └── [cId]/
│           ├── opportunities/
│           ├── competitors/
│           ├── optimization/
│           ├── agent/
│           └── settings/
├── (admin)/                  # Pannello admin
│   ├── layout.tsx            # Layout admin
│   └── admin/
│       ├── page.tsx          # Dashboard admin
│       └── users/
│           ├── page.tsx
│           └── [id]/
│               └── page.tsx
└── api/                      # API Routes (fuori dai route groups)
    ├── auth/
    ├── preview/
    ├── projects/
    ├── admin/
    └── notifications/
```

#### Layout sito marketing
```
┌──────────────────────────────────────────────────┐
│  [Logo Visiblee]        [Pricing] [About] [Login]│  ← Navbar pubblica
├──────────────────────────────────────────────────┤
│                                                  │
│              CONTENUTO PAGINA                    │
│                                                  │
│  (landing page: form above the fold)             │
│  (preview: score + insight + CTA registrazione)  │
│                                                  │
├──────────────────────────────────────────────────┤
│  Footer: link, legal, social, [IT|EN]            │
└──────────────────────────────────────────────────┘
+ Google Analytics 4 (nel layout)
```

#### Layout app (fuori dal progetto)
```
┌──────────────────────────────────────────────────┐
│  [Logo Visiblee]              [Notifiche] [User] │  ← Navbar app
├──────────┬───────────────────────────────────────┤
│          │                                       │
│ Dashboard│         CONTENUTO PRINCIPALE          │
│ Progetti │                                       │
│ Settings │                                       │
│          │                                       │
│──────────│                                       │
│ (admin)  │                                       │
│ Users    │                                       │
│          │                                       │
└──────────┴───────────────────────────────────────┘
```

#### Layout app (dentro un progetto)
```
┌────────────────────────────────────────────────────────┐
│  [Logo]  [← Projects] [Nome Progetto ▾]    [N][U] │  ← Navbar con context
├──────────────┬─────────────────────────────────────────┤
│              │                                         │
│ Overview     │         CONTENUTO PRINCIPALE            │
│ Queries      │                                         │
│ Contents     │                                         │
│ Opportunity  │                                         │
│   Map        │                                         │
│ Competitors  │                                         │
│ Optimization │                                         │
│   Tips       │                                         │
│ GEO Expert   │                                         │
│──────────────│                                         │
│ Settings     │                                         │
│              │                                         │
└──────────────┴─────────────────────────────────────────┘
```

### 4.3 Nomenclatura score (mapping tecnico → UI)

I nomi tecnici usati nel codice, database e API restano invariati per coerenza interna. La mappatura verso i nomi user-friendly avviene esclusivamente nel layer UI tramite le chiavi i18n.

| Nome tecnico (codice/DB/API) | Nome UI (EN) | Nome UI (IT) |
|---|---|---|
| `ai_readiness_score` | AI Readiness Score | AI Readiness Score |
| `fanout_coverage_score` | Query Reach | Query Reach |
| `passage_quality_score` | Answer Strength | Answer Strength |
| `chunkability_score` | Extractability | Extractability |
| `entity_coherence_score` | Brand Trust | Brand Trust |
| `cross_platform_score` | Source Authority | Source Authority |

**Nota**: i nomi degli score restano in inglese anche nella versione italiana dell'interfaccia, perché sono termini di dominio GEO che non beneficiano dalla traduzione (come "SEO" o "ROI" non si traducono). Le descrizioni e le spiegazioni sono invece tradotte.

### 4.4 Sotto-criteri passage quality (mapping tecnico → UI)

| Nome tecnico | Nome UI (EN) | Nome UI (IT) |
|---|---|---|
| `self_containedness` | Standalone Clarity | Chiarezza autonoma |
| `claim_clarity` | Claim Precision | Precisione affermazioni |
| `information_density` | Information Density | Densità informativa |
| `completeness` | Answer Completeness | Completezza risposta |
| `verifiability` | Verifiability | Verificabilità |

### 4.5 Flow utente dettagliato

#### Flow 1: Prima visita — Acquisizione e conversione

**Step 1 — Landing page (`/`)**
L'utente arriva su visiblee.ai. La lingua dell'interfaccia è determinata automaticamente dal browser (Accept-Language). Vede headline + sottotitolo + form above the fold. Il form chiede: URL sito web, nome brand, 3 query target (con placeholder). CTA: "Get your AI Score" / "Ottieni il tuo AI Score". Nessuna registrazione.

GA events: `page_view`, `form_start` (primo campo compilato), `analysis_requested` (submit).

**Step 2 — Analisi in corso**
Dopo il submit il sistema crea un record `preview_analyses` (UUID, nessun user associato, salva `locale` corrente) e avvia il job `preview_analysis`. L'utente viene portato su `/preview/[id]` dove vede un progress indicator: "We're analyzing your site..." / "Stiamo analizzando il tuo sito..." con step che si completano in sequenza. Durata stimata: 30-60 secondi.

L'URL è condivisibile e persistente (30 giorni).

**Step 3 — Risultato preview (`/preview/[id]`)**
Sezione visibile a tutti:
- AI Readiness Score grande e centrale (es. "42/100")
- Radar chart con i 5 sotto-score (nomi user-friendly: Query Reach, Answer Strength, Extractability, Brand Trust, Source Authority)
- 3-4 insight concreti generati nella lingua dell'utente
- Icone `?` accanto a ogni score che aprono un pannello esplicativo

Sezione blurred/locked:
- Lista completa dei contenuti trovati
- Raccomandazioni specifiche
- Dettaglio per passaggio

Due CTA affiancate:
- "Get the report via email" / "Ricevi il report via email" → mostra campo email inline, l'utente inserisce l'email, il sistema genera il PDF nella lingua corrente e lo invia via MailerSend
- "Sign up for full analysis" / "Registrati per l'analisi completa" → CTA principale, più prominente

GA events: `preview_viewed`, `report_requested` (invio email report), `registration_started`.

**Step 4 — Registrazione**
L'utente si registra (Google OAuth o email/password). Se aveva inserito l'email per il report, il form di registrazione la pre-compila. Il sistema:
1. Crea l'utente (con `preferred_locale` dalla preferenza browser corrente)
2. Collega la `preview_analysis` all'utente (`user_id`, `converted_at`)
3. Crea il primo progetto con i dati della preview (zero data re-entry)
4. Importa i risultati dell'analisi nel progetto
5. Avvia l'analisi approfondita in background

GA event: `registration_completed`.

**Step 5 — Redirect nell'app + Onboarding**
L'utente viene portato a `/app/projects/[id]/overview`. Se è il primo accesso, parte l'onboarding wizard (4 step illustrati che spiegano come l'AI decide chi citare). Banner di benvenuto: "We've created your first project. Full analysis is running." / "Abbiamo creato il tuo primo progetto. L'analisi completa è in corso." Quando l'analisi finisce, riceve una notifica.

#### Flow 2: Creazione progetto (utente registrato)

1. Da `/app` → click "New project" / "Nuovo progetto"
2. Wizard 3 step: "Who are you" / "Chi sei" (brand, sito, descrizione) → "What do you monitor" / "Cosa monitori" (3-10 query) → "Where do you publish" / "Dove pubblichi" (piattaforme, URL opzionali)
3. Il sistema avvia discovery + analisi con progress indicator
4. Redirect a overview quando pronto

#### Flow 3: Content Discovery

1. Ricerca su Brave Search API:
   - `site:dominio.com` (pagine sito indicizzate)
   - `"Nome Brand" site:linkedin.com`, `site:medium.com`, etc.
   - `"Nome Brand" -site:dominio.com` (menzioni su terzi)
2. Filtro LLM con contesto brand (entità estratte dal sito come àncora semantica)
3. Presentazione in 3 gruppi: "Your content" / "I tuoi contenuti" (alta confidenza, auto-aggiunti), "Mentions" / "Menzioni" (media confidenza), "To verify" / "Da verificare" (bassa confidenza)
4. L'utente conferma/scarta con toggle
5. Contenuti confermati → coda fetch + analisi
6. Dato bonus: contenuti inseriti manualmente che non risultano indicizzati vengono segnalati ("Not found in Google's index" / "Non trovato nell'indice di Google")

#### Flow 4: Ciclo settimanale (automatico)

1. Ogni settimana: ri-crawl contenuti per catturare modifiche
2. Ri-generazione query fan-out
3. Ricalcolo embedding per contenuti modificati
4. Ricalcolo tutti gli score
5. Salvataggio snapshot (tipo: `weekly`)
6. Generazione/aggiornamento raccomandazioni (nella lingua dell'utente)
7. Notifica: "New weekly report available" / "Nuovo report settimanale disponibile"
8. Il ricalcolo manuale on-demand è sempre disponibile (snapshot tipo: `manual`)

### 4.6 Wizard e onboarding educativi

#### Onboarding tour (primo accesso)

Un wizard a 4 step illustrati che appare al primo login. Skippabile e rivedibile dalle impostazioni utente.

| Step | Titolo (EN) | Titolo (IT) | Contenuto |
|------|---|---|---|
| 1 | "AI search is different" | "La ricerca AI è diversa" | L'AI non mostra link — genera risposte. I tuoi contenuti devono essere citati, non solo trovati. |
| 2 | "It starts with questions" | "Tutto parte dalle domande" | Per ogni ricerca, l'AI genera decine di domande correlate (Query Reach). Devi coprire l'intero ventaglio. |
| 3 | "Every paragraph competes" | "Ogni paragrafo compete" | L'AI confronta i passaggi uno contro l'altro. Ogni paragrafo deve essere forte da solo (Answer Strength). |
| 4 | "Visiblee shows you how" | "Visiblee ti mostra come" | Analizziamo i tuoi contenuti, misuriamo 5 aspetti chiave, e ti diciamo esattamente cosa migliorare. |

**Persistenza**: il flag `onboarding_completed` viene salvato come campo JSONB nelle impostazioni utente (o in un cookie). Se l'utente lo skippa, può riaprirlo da Settings.

#### Pannelli "Come funziona?" (per ogni score)

Icona `?` accanto a ogni score. Click apre un pannello laterale (drawer) con:
1. **Spiegazione semplice** (2-3 frasi non tecniche)
2. **Esempio concreto** (scenario reale per il tipo di utente)
3. **Cosa fare per migliorare** (1-2 azioni rapide)
4. **Link a documentazione** (futuro blog post o help center)

Esempio per Query Reach:
> "When someone searches for something, the AI doesn't just use their exact words. It generates dozens of related questions to give a complete answer. Query Reach measures how many of those questions your content can answer."
> 
> "Example: If someone searches 'accountant for startups in Milan', the AI might also ask 'tax benefits for innovative startups', 'differences between accounting firms', 'costs of a startup accountant'. If your site covers these topics, your Query Reach is high."

#### Empty states educativi

Quando una sezione non ha ancora dati (es. prima che l'analisi completa termini), mostra:
- Illustrazione/icona
- Spiegazione di cosa verrà mostrato
- Perché è utile
- CTA per avviare l'azione che popola la sezione (se applicabile)

---

## 5. Internazionalizzazione (i18n) — Implementazione tecnica

### 5.1 Libreria e configurazione

**Libreria**: `next-intl` — scelta per la piena integrazione con Next.js App Router e React Server Components.

**Configurazione base**:
```
// i18n/config.ts
export const locales = ['en', 'it'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';
```

### 5.2 Detection lingua

L'ordine di priorità per determinare la lingua:
1. Cookie `NEXT_LOCALE` (se l'utente ha scelto manualmente)
2. Header `Accept-Language` del browser
3. Fallback: `en`

Il middleware `next-intl` intercetta ogni request, determina la lingua e la inietta nel contesto senza modificare l'URL.

### 5.3 Struttura file traduzioni

```
messages/
├── en.json          # Traduzioni inglese
└── it.json          # Traduzioni italiano
```

I file sono organizzati per namespace:
```json
{
  "common": { "save": "Save", "cancel": "Cancel", ... },
  "nav": { "overview": "Overview", "queries": "Queries", ... },
  "scores": { 
    "aiReadiness": "AI Readiness Score",
    "queryReach": "Query Reach",
    "queryReach.description": "How many related questions your content can answer",
    ...
  },
  "landing": { "headline": "...", "cta": "Get your AI Score", ... },
  "preview": { ... },
  "onboarding": { ... }
}
```

### 5.4 Contenuti generati da AI

I contenuti generati dall'AI (insight nella preview, raccomandazioni, reasoning) vengono prodotti nella lingua dell'utente. Il parametro `language` viene passato ai prompt LLM:
- Preview: usa il `locale` salvato nel record `preview_analyses`
- Area loggata: usa il `preferred_locale` dell'utente o la lingua corrente della sessione
- Email report: usa il `locale` della preview

### 5.5 Cambio lingua

La lingua è determinata automaticamente dal browser al primo accesso. L'utente può cambiarla manualmente dalla pagina **Settings** (`/app/settings`), dove trova una select "Language / Lingua". Al cambio:
1. Scrive il cookie `NEXT_LOCALE`
2. Aggiorna `preferred_locale` nel DB (se loggato)
3. Fa un soft refresh della pagina (nessun cambio URL)

Per gli utenti non autenticati (sito marketing, preview), la lingua è rilevata dal browser. Un selettore lingua è disponibile nel footer del sito marketing per chi vuole cambiarla manualmente.

---

## 6. Google Analytics — Implementazione

### 6.1 Scope
GA4 è presente SOLO nel layout `(marketing)`. L'area loggata NON ha GA — le azioni utente vengono tracciate internamente nel database (tabella `jobs`, `notifications`, e campi `updated_at` sulle entità).

### 6.2 Setup
Il Google Tag ID va in una variabile d'ambiente: `NEXT_PUBLIC_GA_MEASUREMENT_ID`.

Componente GA nel `(marketing)/layout.tsx`:
```tsx
// components/analytics/GoogleAnalytics.tsx
// Script tag con gtag.js, caricato solo in produzione
// Funzione helper sendGAEvent(eventName, params) esportata per uso nei componenti
```

### 6.3 Eventi tracciati

| Evento | Dove | Trigger |
|--------|------|---------|
| `page_view` | Tutte le pagine marketing | Automatico (GA4) |
| `form_start` | Landing page | Primo campo del form compilato |
| `analysis_requested` | Landing page | Submit del form |
| `preview_viewed` | `/preview/[id]` | Caricamento pagina con risultati |
| `report_requested` | `/preview/[id]` | Submit email per ricevere report PDF |
| `registration_started` | `/preview/[id]` o `/register` | Click su CTA registrazione |
| `registration_completed` | Post-registrazione | Callback dopo creazione utente |

### 6.4 Funnel
Il funnel principale da monitorare: Visite landing → Form start → Analisi richieste → Preview viste → Report richiesti via email → Registrazioni avviate → Registrazioni completate.

---

## 7. Implementazione degli score — Dettaglio tecnico

### 7.1 Fan-Out Coverage Score (UI: "Query Reach")

**Input**: query target dell'utente, contenuti (passaggi con embedding)

**Pipeline**:
```python
# 1. Genera query fan-out (Gemini 2.0 Flash)
fanout_queries = generate_fanout(
    target_query="commercialista per startup Milano",
    brand_context="Studio commerciale specializzato in startup e PMI innovative",
    num_queries=20,
    categories=["related", "implicit", "comparative", "exploratory", "decisional", "recent"],
    language="it"  # genera query nella lingua dell'utente
)

# 2. Genera embedding per le query fan-out (Voyage AI)
fanout_embeddings = embed_texts([q.text for q in fanout_queries])

# 3. Per ogni query fan-out, calcola similarity con tutti i passaggi
for fq in fanout_queries:
    similarities = cosine_similarity(fq.embedding, all_passage_embeddings)
    best_match = max(similarities)
    fq.is_covered = best_match > THRESHOLD  # 0.75 iniziale
    fq.best_passage = passages[argmax(similarities)]
    fq.similarity_score = best_match

# 4. Calcola score
covered_count = sum(1 for fq in fanout_queries if fq.is_covered)
fanout_score = (covered_count / len(fanout_queries)) * 100
```

**Prompt per la generazione fan-out** (Gemini):
```
Sei un sistema di espansione delle query di ricerca. Data la query principale e il contesto del brand, 
genera {num_queries} query sintetiche che un sistema di AI search genererebbe per rispondere in modo 
completo alla query originale.

Per ogni query, indica la categoria:
- related: riformulazioni e sinonimi
- implicit: bisogni informativi non espressi ma sottintesi
- comparative: confronti con alternative
- exploratory: approfondimenti su sotto-aspetti
- decisional: orientate alla scelta
- recent: versioni time-sensitive

Query principale: {target_query}
Contesto brand: {brand_context}
Lingua: {language}

Rispondi SOLO in formato JSON:
[{"query": "...", "category": "...", "reasoning": "..."}]
```

### 7.2 Passage-Level Quality Score (UI: "Answer Strength")

**Input**: passaggio di testo, query target associata

**Pipeline**:
```python
# Per ogni passaggio, chiedi a Claude Sonnet di valutare
evaluation = evaluate_passage(
    passage=passage.text,
    query=target_query.text,
    language=user_locale,  # reasoning nella lingua dell'utente
    rubric={
        "self_containedness": "Il passaggio ha senso letto in completo isolamento? (0-10)",
        "claim_clarity": "Contiene affermazioni chiare, specifiche e non ambigue? (0-10)",
        "information_density": "Qual è il rapporto tra informazione utile e filler? (0-10)",
        "completeness": "Risponde a una domanda specifica in modo esauriente? (0-10)",
        "verifiability": "Le affermazioni sono supportate da dati, fonti, numeri? (0-10)"
    }
)

# Score normalizzato a 100
passage_score = (
    evaluation.self_containedness * 2.5 +  # peso 25%
    evaluation.claim_clarity * 2.0 +        # peso 20%
    evaluation.information_density * 2.0 +  # peso 20%
    evaluation.completeness * 2.0 +         # peso 20%
    evaluation.verifiability * 1.5          # peso 15%
)
```

**Prompt per il quality judging** (Claude Sonnet):
```
Sei un valutatore di qualità dei passaggi di testo per la visibilità nei motori di ricerca AI.

Valuta il seguente passaggio rispetto alla query indicata. Per ogni criterio, assegna un punteggio 
da 0 a 10 e fornisci una breve spiegazione.

Query: {query}
Passaggio: {passage}

Criteri:
1. Self-containedness (0-10): Il passaggio ha senso completo se letto in isolamento?
2. Claim clarity (0-10): Le affermazioni sono chiare, specifiche e non ambigue?
3. Information density (0-10): Rapporto tra informazione utile e contenuto superfluo?
4. Completeness (0-10): Risponde a una domanda specifica in modo esauriente?
5. Verifiability (0-10): Le affermazioni sono supportate da dati, fonti o esempi concreti?

Rispondi in JSON (nella lingua: {language}):
{
  "self_containedness": {"score": N, "reasoning": "..."},
  "claim_clarity": {"score": N, "reasoning": "..."},
  "information_density": {"score": N, "reasoning": "..."},
  "completeness": {"score": N, "reasoning": "..."},
  "verifiability": {"score": N, "reasoning": "..."}
}
```

### 7.3 Chunkability Score (UI: "Extractability")

**Input**: contenuto HTML/testo con struttura

**Pipeline** (euristico, senza LLM):
```python
def compute_chunkability(content):
    passages = content.passages
    
    # 1. Paragraph length score (ottimale: 134-167 parole)
    length_scores = []
    for p in passages:
        wc = p.word_count
        if 134 <= wc <= 167:
            length_scores.append(1.0)
        elif 100 <= wc <= 250:
            length_scores.append(0.7)
        elif 50 <= wc <= 300:
            length_scores.append(0.4)
        else:
            length_scores.append(0.1)
    paragraph_length = mean(length_scores)
    
    # 2. Heading coverage
    passages_with_heading = sum(1 for p in passages if p.heading)
    heading_coverage = passages_with_heading / len(passages)
    
    # 3. Self-reference pollution
    self_ref_patterns = [
        r'\bcome (detto|menzionato|visto|spiegato) (sopra|prima|precedentemente)\b',
        r'\bquesto (significa|implica|dimostra)\b',
        r'\bciò (che|nonostante)\b',
        r'\bas mentioned (above|earlier|before)\b',
        r'\bthis (means|implies|shows)\b',
    ]
    total_refs = count_pattern_matches(content.raw_text, self_ref_patterns)
    self_ref_ratio = min(total_refs / len(passages), 1.0)
    
    # 4. Schema/markup presence
    has_schema = detect_structured_data(content.raw_html)
    has_tables = detect_tables(content.raw_html)
    has_lists = detect_lists(content.raw_html)
    schema_score = (has_schema * 0.4 + has_tables * 0.3 + has_lists * 0.3)
    
    # 5. Answer-first structure
    answer_first_scores = []
    for p in passages:
        first_sentence = get_first_sentence(p.text)
        if contains_definition_or_answer(first_sentence):
            answer_first_scores.append(1.0)
        else:
            answer_first_scores.append(0.3)
    answer_position = mean(answer_first_scores)
    
    # Calcolo finale
    chunkability = (
        paragraph_length * 25 +
        heading_coverage * 25 +
        (1 - self_ref_ratio) * 20 +
        schema_score * 15 +
        answer_position * 15
    )
    
    return chunkability  # 0-100
```

### 7.4 Entity Coherence Score (UI: "Brand Trust")

**Input**: tutti i contenuti del progetto

**Pipeline**:
```python
def compute_entity_coherence(project):
    all_contents = project.confirmed_contents
    
    # 1. Estrai entità chiave da tutti i contenuti (LLM batch)
    entities = extract_entities(all_contents, brand_name=project.brand_name)
    
    # 2. Term consistency
    term_variations = find_term_variations(entities)
    term_consistency = 1 - (len(term_variations) / max(len(entities), 1))
    
    # 3. Semantic cohesion
    content_embeddings = [mean(c.passage_embeddings) for c in all_contents]
    pairwise_similarities = all_pairwise_cosine(content_embeddings)
    semantic_cohesion = mean(pairwise_similarities)
    
    # 4. Co-occurrence
    brand_entity = project.brand_name
    co_occurrence = count_co_occurrences(brand_entity, entities, all_contents)
    co_occurrence_strength = co_occurrence / len(all_contents)
    
    # 5. Cross-platform presence
    platforms = set(c.platform for c in all_contents)
    platform_diversity = len(platforms) / 7
    
    entity_score = (
        term_consistency * 30 +
        semantic_cohesion * 100 * 25 +
        co_occurrence_strength * 100 * 20 +
        platform_diversity * 100 * 25
    )
    
    return min(entity_score, 100)
```

### 7.5 Cross-Platform Signal Strength Score (UI: "Source Authority")

**Input**: contenuti del progetto raggruppati per piattaforma

**Pipeline**:
```python
PLATFORM_WEIGHTS = {
    'website': 1.0,
    'linkedin': 0.8,
    'medium': 0.7,
    'substack': 0.7,
    'news': 0.9,
    'youtube': 0.6,
    'reddit': 0.4,
    'other': 0.3,
}

def compute_cross_platform(project):
    contents_by_platform = group_by(project.contents, 'platform')
    
    platform_scores = []
    for platform, weight in PLATFORM_WEIGHTS.items():
        contents = contents_by_platform.get(platform, [])
        if not contents:
            platform_scores.append(0)
            continue
        presence = min(len(contents) / 5, 1.0)
        newest = max(c.last_modified_at for c in contents)
        days_old = (now() - newest).days
        freshness = max(0, 1 - (days_old / 365))
        platform_scores.append(weight * presence * freshness)
    
    max_possible = sum(PLATFORM_WEIGHTS.values())
    cross_platform_score = (sum(platform_scores) / max_possible) * 100
    
    return cross_platform_score
```

### 7.6 Preview Analysis (versione rapida per landing page)

La micro-analisi è una versione semplificata della pipeline completa, ottimizzata per velocità (target: 30-60 secondi):

```python
def preview_analyze(website_url, brand_name, query_targets, language="en"):
    # 1. Quick crawl: cerca su Brave solo le pagine del sito (max 20 risultati)
    pages = brave_search(f"site:{extract_domain(website_url)}", count=20)
    
    # 2. Fetch e chunk solo le prime 5-10 pagine più rilevanti
    top_pages = pages[:10]
    for page in top_pages:
        page.text = fetch_text(page.url)
        page.passages = chunk_text(page.text)
    
    # 3. Fan-out rapido: genera 10 query sintetiche per ogni query target (vs 20 nel full)
    all_fanout = []
    for qt in query_targets:
        fanout = generate_fanout(qt, brand_name, num_queries=10, language=language)
        all_fanout.extend(fanout)
    
    # 4. Embedding + coverage (stesso metodo, meno dati)
    # 5. Passage quality: valuta solo un campione di passaggi (es: 2 per pagina)
    # 6. Chunkability: euristico rapido su tutte le pagine
    # 7. Entity coherence: versione semplificata (solo term consistency)
    # 8. Cross-platform: quick search su Brave per altre piattaforme
    
    # 9. Genera 3-4 insight testuali basati sui gap più evidenti (nella lingua dell'utente)
    insights = generate_insights(scores, gaps, language=language)
    
    return {scores, insights, contents_found: len(pages)}
```

---

## 8. Content Discovery — Dettaglio implementazione

### 8.1 Pipeline di discovery via Brave Search API

```python
def discover_content(project):
    brand = project.brand_name
    domain = extract_domain(project.website_url)
    
    search_queries = [
        f"site:{domain}",
        f'"{brand}" site:linkedin.com',
        f'"{brand}" site:medium.com',
        f'"{brand}" site:substack.com',
        f'"{brand}" site:reddit.com',
        f'"{brand}" site:youtube.com',
        f'"{brand}" -site:{domain}',
    ]
    
    all_results = []
    for query in search_queries:
        results = brave_search(query, count=20)
        all_results.extend(results)
    
    unique_results = deduplicate_by_url(all_results)
    classified = classify_results(unique_results, project)
    
    return classified
```

### 8.2 Classificazione pertinenza (LLM)

```python
def classify_results(results, project):
    classifications = llm_classify(
        model="claude-haiku",
        context={
            "brand_name": project.brand_name,
            "website": project.website_url,
            "brand_context": project.brand_context,
        },
        items=[{"url": r.url, "title": r.title, "snippet": r.snippet} for r in results]
    )
    
    high_confidence = []    # "Your content" / "I tuoi contenuti" (auto-aggiunti)
    medium_confidence = []  # "Mentions" / "Menzioni del tuo brand"
    low_confidence = []     # "To verify" / "Da verificare"
    
    for r, c in zip(results, classifications):
        r.classification = c.type
        r.confidence = c.confidence
        r.content_type = c.type
        
        if c.type == 'not_relevant':
            continue
        elif c.confidence > 0.8:
            high_confidence.append(r)
        elif c.confidence > 0.5:
            medium_confidence.append(r)
        else:
            low_confidence.append(r)
    
    return {
        'confirmed': high_confidence,
        'mentions': medium_confidence,
        'to_verify': low_confidence,
    }
```

### 8.3 Segnale di ancoraggio

Il sito web del cliente è l'àncora semantica per il filtro di classificazione. Il sistema prima analizza il sito, estrae le entità chiave (persone, prodotti, topic), e usa queste entità come contesto nel prompt di classificazione per valutare la pertinenza dei risultati sulle altre piattaforme.

### 8.4 Verifica indicizzazione

Ogni contenuto inserito manualmente dall'utente viene verificato contro Brave Search. Se non è trovato nell'indice, viene segnalato con badge "Not indexed" / "Non indicizzato" e messaggio: "This content is not indexed. AI Mode cannot use it in its answers." / "Questo contenuto non risulta indicizzato. AI Mode non può utilizzarlo nelle sue risposte."

---

## 9. Email transazionali — Implementazione

### 9.1 Provider

**MailerSend** con account esistente a pagamento. Template HTML gestiti via API MailerSend o generati lato server.

### 9.2 Email previste

| Email | Trigger | Contenuto |
|-------|---------|-----------|
| Report PDF preview | Utente inserisce email nella preview | PDF allegato con AI Readiness Score, radar, insight, CTA registrazione |
| Welcome | Registrazione completata | Benvenuto, link al progetto, prossimi step |
| Analysis complete | Analisi completa terminata | Notifica con link ai risultati |
| Weekly report | Snapshot settimanale salvato | Riepilogo score, variazioni, link alla dashboard |

### 9.3 Template

I template sono componenti React Email, tradotti tramite i18n. La lingua è determinata da:
- `preview_analyses.locale` per il report preview
- `users.preferred_locale` per tutte le altre email

### 9.4 Architettura

L'invio email avviene tramite un job nella tabella `jobs` (tipo: `send_report_email`). Le API routes Next.js creano il job, il worker (Node.js o Python) lo processa:
1. Genera il PDF con i dati dell'analisi nella lingua corretta
2. Invia l'email via MailerSend con il PDF allegato
3. Aggiorna `preview_analyses.report_sent_at`

---

## 10. Pannello Admin (Superadmin)

### 10.1 Funzionalità

- **Dashboard admin**: metriche globali (utenti totali, progetti attivi, analisi in corso, preview non convertite, tasso di conversione email→registrazione)
- **Gestione utenti**: lista con ricerca, filtri, ordinamento
  - Per ogni utente: email, data registrazione, numero progetti, ultimo accesso, provider auth, lingua preferita
  - Azioni: cambiare ruolo, disattivare account, resettare password
- **Vista progetti utente**: il superadmin entra nella dashboard di qualsiasi utente in modalità read-only (customer success)
- **Job monitor**: stato dei job in coda (pending, running, failed), inclusi job email
- **Preview monitor**: lista delle preview analysis (convertite vs non convertite, tasso di conversione, email raccolte)

### 10.2 Accesso

Il ruolo `superadmin` viene assegnato direttamente nel database. La middleware Next.js blocca l'accesso alle rotte `/admin/*` per utenti non autorizzati. Non esiste UI per auto-promuoversi.

---

## 11. Piano di sviluppo (Fasi)

### Fase 1 — Foundation
- Setup monorepo (Next.js + Python)
- Setup i18n con next-intl (IT/EN, detection browser, cambio lingua in Settings)
- Database schema + migrazioni Prisma
- Autenticazione (Google OAuth + email/password)
- Layout base: shell marketing (navbar pubblica + footer con selettore lingua), shell app (sidebar + navbar), shell admin
- Ruoli utente + pannello admin base (CRUD utenti)
- CRUD progetti
- Pagine placeholder per tutte le route (con empty state educativi)

### Fase 2 — Landing Page & Preview Flow
- Landing page con form
- Integrazione Brave Search API
- Pipeline preview analysis (versione rapida)
- Pagina risultato preview (`/preview/[id]`) con nomi score user-friendly e pannelli `?`
- Setup MailerSend (email transazionali)
- Invio report PDF via email (con campo email inline nella preview)
- Flow registrazione con collegamento preview → progetto (pre-compilazione email)
- Google Analytics 4 (setup + eventi funnel aggiornati)

### Fase 3 — Content Discovery & Onboarding
- Pipeline di discovery completa (ricerca + classificazione LLM)
- UI gestione contenuti (conferma/scarta/aggiungi manuale)
- Fetch e estrazione testo dalle URL
- Segmentazione in passaggi
- Verifica indicizzazione
- Badge "indexed" / "not indexed"
- Onboarding wizard (4 step illustrati)
- Pannelli "Come funziona?" per ogni score

### Fase 4 — Scoring Engine
- Integrazione embedding (Voyage AI o OpenAI)
- Fan-out simulation completa (Gemini)
- Calcolo Query Reach (Fan-Out Coverage Score)
- Calcolo Answer Strength (Passage Quality Score — Claude Sonnet)
- Calcolo Extractability (Chunkability Score — euristico)
- Calcolo Brand Trust (Entity Coherence Score)
- Calcolo Source Authority (Cross-Platform Signal Strength)
- AI Readiness Score composito
- Sistema di snapshot (salvataggio score settimanale + manuale)

### Fase 5 — Dashboard & Visualization
- Overview progetto (score con nomi user-friendly + radar + trend storico)
- Vista contenuti con score individuali
- Dettaglio contenuto con score per passaggio (sotto-criteri con nomi user-friendly + tooltip)
- Opportunity Map (query fan-out verdi/gialle/rosse)
- Sistema notifiche

### Fase 6 — Optimization & Competitors
- Generazione raccomandazioni (LLM, nella lingua dell'utente)
- Optimization Tips hub (priorità, impatto, stato)
- Discovery competitor (da Brave Search per le query target)
- Benchmark competitor
- Report PDF completo (area loggata, inviato via email)

### Fase 7 — GEO Expert & Polish
- Interfaccia conversazionale GEO Expert (agente AI)
- Generazione/riscrittura contenuti
- Job scheduler per ciclo settimanale automatico
- Email settimanali automatiche
- Refinement UX
- Pulizia automatica preview scadute

---

## 12. Convenzioni di sviluppo

### 12.1 Struttura directory (monorepo)

```
visiblee/
├── apps/
│   └── web/                        # Next.js app
│       ├── app/                    # App Router
│       │   ├── (marketing)/        # Sito pubblico + GA4
│       │   │   ├── layout.tsx
│       │   │   ├── page.tsx        # Landing page
│       │   │   └── preview/[id]/
│       │   ├── (auth)/             # Login / Register
│       │   │   ├── layout.tsx
│       │   │   ├── login/
│       │   │   └── register/
│       │   ├── (app)/              # Area autenticata
│       │   │   ├── layout.tsx      # Shell app (sidebar + navbar)
│       │   │   ├── app/
│       │   │   └── projects/
│       │   │       ├── new/
│       │   │       └── [id]/
│       │   │           ├── layout.tsx  # Sidebar progetto
│       │   │           ├── overview/
│       │   │           ├── queries/
│       │   │           ├── contents/
│       │   │           │   └── [cId]/
│       │   │           ├── opportunities/
│       │   │           ├── competitors/
│       │   │           ├── optimization/
│       │   │           ├── agent/
│       │   │           └── settings/
│       │   ├── (admin)/            # Pannello admin
│       │   │   ├── layout.tsx
│       │   │   └── admin/
│       │   │       ├── page.tsx
│       │   │       └── users/
│       │   └── api/                # API Routes
│       │       ├── auth/
│       │       ├── preview/
│       │       ├── projects/
│       │       ├── admin/
│       │       └── notifications/
│       ├── components/
│       │   ├── ui/                 # shadcn/ui
│       │   ├── layout/            # Shell, Sidebar, Navbar (marketing + app + admin)
│       │   ├── analytics/         # GoogleAnalytics component
│       │   ├── onboarding/        # Onboarding wizard, score explainers, empty states
│       │   └── features/          # Componenti per feature
│       ├── lib/
│       │   ├── auth.ts            # Auth.js config
│       │   ├── db.ts              # Prisma client
│       │   ├── analytics.ts       # GA4 helper (sendGAEvent)
│       │   ├── api.ts             # Client per Python microservice
│       │   └── email.ts           # MailerSend client + template helpers
│       ├── i18n/
│       │   ├── config.ts          # Locales, default locale
│       │   └── request.ts         # next-intl request config
│       ├── messages/
│       │   ├── en.json            # Traduzioni inglese
│       │   └── it.json            # Traduzioni italiano
│       └── prisma/
│           └── schema.prisma
├── services/
│   └── analyzer/                   # Python microservice
│       ├── app/
│       │   ├── main.py            # FastAPI entrypoint
│       │   ├── routers/
│       │   ├── services/
│       │   ├── models/
│       │   └── prompts/           # LLM prompts (versionati)
│       └── requirements.txt
├── packages/                       # Shared (se necessario)
├── docs/
│   ├── architecture/              # ADR
│   └── api/
├── CLAUDE.md                       # Stato progetto per Claude Code
├── README.md
└── package.json                    # Workspace root
```

### 12.2 Naming conventions

- **Database**: snake_case per tabelle e colonne (nomi tecnici, non user-friendly)
- **TypeScript**: camelCase per variabili, PascalCase per tipi e componenti
- **Python**: snake_case per tutto, PascalCase per classi
- **API routes**: kebab-case per gli URL
- **File**: kebab-case per i file, PascalCase per i componenti React
- **i18n keys**: camelCase con dot notation per namespace (es. `scores.queryReach.description`)
- **Score names UI**: i nomi user-friendly (Query Reach, Answer Strength, ecc.) vivono solo nei file di traduzione, mai hardcoded nei componenti

### 12.3 Git conventions

- Branch: `feature/nome-feature`, `fix/nome-fix`, `refactor/nome`
- Commit messages: tipo convenzionale (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`)
- Un commit = una unità logica di lavoro
- Mai multi-feature nello stesso commit

### 12.4 Environment variables

```env
# Database
DATABASE_URL=postgresql://...

# Auth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Python microservice
ANALYZER_API_URL=http://localhost:8000
ANALYZER_API_KEY=...

# LLM providers
ANTHROPIC_API_KEY=...
GOOGLE_AI_API_KEY=...       # Gemini
VOYAGE_API_KEY=...           # oppure OPENAI_API_KEY per embedding

# Brave Search
BRAVE_SEARCH_API_KEY=...

# Email (MailerSend)
MAILERSEND_API_KEY=...
EMAIL_FROM=noreply@visiblee.ai

# Analytics (solo frontend, prefisso NEXT_PUBLIC_)
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```
