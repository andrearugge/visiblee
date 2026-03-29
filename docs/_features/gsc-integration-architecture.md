# Architettura: Integrazione Google Search Console — Visiblee v2

> **Data**: Marzo 2026
> **Stato**: ✅ IMPLEMENTATO (Fasi A–F complete)
> **Scopo**: specifica completa per l'integrazione GSC in Visiblee. Usare come riferimento per manutenzione ed evoluzioni future.
> **Prerequisito**: leggere `product-state.md` e `architectural-decisions.md` prima di proporre modifiche.

---

## 1. Obiettivo e valore

### 1.1 Cosa stiamo costruendo

Un'integrazione con la Google Search Console API che permette a Visiblee di:

1. **Importare le query reali** che portano impression/click al sito dell'utente, incluse le query conversazionali tipiche di AI Mode.
2. **Classificare le query per intento** (informational, comparative, decisional, navigational) e raggrupparle in "Intent Profiles".
3. **Suggerire nuove query target** basate su dati reali GSC, non solo intuizione dell'utente.
4. **Arricchire il citation check** con varianti di contesto derivate dai profili di intento, per simulare come utenti diversi ricevono risposte diverse da AI Mode.

### 1.2 Cosa NON stiamo costruendo (in questa fase)

- Integrazione GA4 (fase successiva)
- Dashboard di traffico AI referral (fase successiva)
- Modifica dello scoring euristico (AD-02 resta invariato)
- Sostituzione del citation check esistente (lo arricchiamo, non lo sostituiamo)

### 1.3 Coerenza con le decisioni architetturali

| ADR | Impatto | Note |
|-----|---------|------|
| AD-01 (FastAPI separato) | ✅ Rispettato | OAuth token exchange in Next.js API Routes (operazione semplice). Data pull, classificazione intento, e enrichment in Python microservice |
| AD-02 (no LLM scoring) | ✅ Rispettato | La classificazione intento è euristica (regex + pattern matching). Gemini Flash usato SOLO per clustering semantico delle query, MAI per scoring |
| AD-03 (Gemini citation check) | ✅ Rispettato | Le varianti di contesto usano sempre Gemini Grounding. Il system prompt cambia, non il meccanismo |
| AD-09 (job queue DB) | ✅ Rispettato | Nuovi job types nella stessa tabella `jobs` |
| AD-10 (target espliciti) | ✅ Complementare | I dati GSC arricchiscono i target, non li sostituiscono. L'utente sceglie sempre le query target |

---

## 2. Architettura ad alto livello

```
┌─────────────────────────────────────────────────────┐
│                    NEXT.JS (Vercel)                   │
│                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │ Project      │  │ API Route    │  │ API Route   │ │
│  │ Settings UI  │  │ /api/gsc/    │  │ /api/gsc/   │ │
│  │ "Connect GSC"│  │ connect      │  │ callback    │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘ │
│         │                 │                  │        │
│         │          ┌──────┴──────┐           │        │
│         │          │ API Route   │           │        │
│         │          │ /api/gsc/   │           │        │
│         │          │ properties  │           │        │
│         │          └─────────────┘           │        │
│         │                                    │        │
│  ┌──────┴────────────────────────────────────┴──────┐ │
│  │              PostgreSQL (Prisma)                   │ │
│  │  gsc_connections | gsc_query_data | intent_profiles│ │
│  └──────────────────────┬────────────────────────────┘ │
└─────────────────────────┼─────────────────────────────┘
                          │
              ┌───────────┴───────────┐
              │   PYTHON (Hetzner)     │
              │                        │
              │  ┌──────────────────┐  │
              │  │ gsc_sync.py      │  │  ← Pull dati da GSC API
              │  │                  │  │    usando refresh token dal DB
              │  └────────┬─────────┘  │
              │           │            │
              │  ┌────────┴─────────┐  │
              │  │ intent_engine.py │  │  ← Classificazione intento
              │  │                  │  │    euristica + clustering
              │  └────────┬─────────┘  │
              │           │            │
              │  ┌────────┴─────────┐  │
              │  │ citation_check.py│  │  ← Varianti di contesto
              │  │ (estensione)     │  │    per citation simulation
              │  └──────────────────┘  │
              └────────────────────────┘
```

---

## 3. OAuth Flow — Dettaglio completo

### 3.1 Perché un flow OAuth separato

Visiblee usa già Google OAuth per il login (Auth.js v5). Tuttavia, il login richiede scope minimal (`openid`, `email`, `profile`). L'accesso a GSC richiede uno scope aggiuntivo (`webmasters.readonly`) che NON va richiesto al momento del login — altrimenti gli utenti vedrebbero una richiesta di permessi spaventosa prima ancora di registrarsi.

La soluzione è un **flow OAuth separato** attivato dall'utente nelle impostazioni del progetto, dopo che ha già creato il progetto e vuole collegare GSC.

### 3.2 Prerequisiti Google Cloud

Prima dell'implementazione, configurare nel Google Cloud Console del progetto Visiblee:

1. Abilitare la **Google Search Console API** (oltre alle API già abilitate per il login)
2. Aggiungere lo scope `https://www.googleapis.com/auth/webmasters.readonly` nella schermata di consenso OAuth
3. Aggiungere il redirect URI: `https://app.visiblee.io/api/gsc/callback` (e `http://localhost:3000/api/gsc/callback` per dev)
4. Usare lo STESSO OAuth Client ID del login Google (semplifica la gestione)

### 3.3 Flow step-by-step

```
1. Utente clicca "Collega Google Search Console" nelle Settings del progetto
                    │
                    ▼
2. Next.js genera URL OAuth con:
   - client_id: process.env.GOOGLE_CLIENT_ID (stesso del login)
   - redirect_uri: /api/gsc/callback
   - scope: https://www.googleapis.com/auth/webmasters.readonly
   - access_type: offline (per ottenere refresh_token)
   - prompt: consent (forza re-consenso per ottenere refresh_token)
   - state: JSON.stringify({ projectId, userId, csrfToken })
                    │
                    ▼
3. Google mostra consent screen: "Visiblee vuole accedere ai tuoi dati Search Console"
   Utente approva.
                    │
                    ▼
4. Google redirect a /api/gsc/callback?code=AUTH_CODE&state=STATE
                    │
                    ▼
5. API Route /api/gsc/callback:
   a. Valida state (CSRF + projectId + userId corrisponde alla sessione)
   b. Scambia AUTH_CODE per access_token + refresh_token via POST a https://oauth2.googleapis.com/token
   c. Salva tokens criptati nel DB (tabella gsc_connections)
   d. Redirect a /app/projects/[projectId]/settings?gsc=connected
                    │
                    ▼
6. Settings page mostra "GSC connesso ✓" e lista delle proprietà disponibili
   (caricata via API Route /api/gsc/properties che chiama GSC API sites.list)
                    │
                    ▼
7. Utente seleziona la proprietà GSC da collegare al progetto
   (autocompleta con match sull'URL del progetto)
                    │
                    ▼
8. Salva gsc_connections.propertyUrl e trigga primo job gsc_sync
```

### 3.4 Gestione token

- **access_token**: dura 1 ora. Il Python lo rinnova automaticamente usando il refresh_token prima di ogni sync.
- **refresh_token**: non scade (salvo revoca da parte dell'utente). Va criptato nel DB.
- **Encryption**: usare `aes-256-gcm` con chiave da env var `GSC_TOKEN_ENCRYPTION_KEY`. La chiave DEVE essere diversa da qualsiasi altra chiave nel sistema.
- **Revoca/disconnessione**: l'utente può disconnettere GSC dalle Settings → cancella i token dal DB e i dati GSC sincronizzati.

### 3.5 Errori da gestire

| Errore | Causa | Azione |
|--------|-------|--------|
| `invalid_grant` durante refresh | Utente ha revocato accesso da Google Account | Segnare connessione come `status: 'revoked'`, mostrare banner "Ricollega GSC" |
| `403 Forbidden` su sites.list | Utente non ha accesso a nessuna proprietà GSC | Mostrare messaggio "Nessuna proprietà trovata. Verifica di aver accesso a Search Console per il tuo sito." |
| Proprietà non corrisponde all'URL del progetto | Utente ha collegato un sito diverso | Warning (non errore): "La proprietà selezionata non corrisponde all'URL del progetto. I dati potrebbero non essere rilevanti." |
| Rate limit GSC API (200 req/min) | Troppi sync simultanei | Retry con exponential backoff nel Python worker |

---

## 4. Schema Database (Prisma)

### 4.1 Nuova tabella: `gsc_connections`

```prisma
model GscConnection {
  id                String   @id @default(cuid())
  projectId         String   @unique  // 1 connessione per progetto
  userId            String              // chi ha autorizzato
  
  // OAuth tokens (encrypted)
  accessToken       String              // AES-256-GCM encrypted
  refreshToken      String              // AES-256-GCM encrypted
  tokenExpiresAt    DateTime            // quando scade l'access_token
  
  // GSC property
  propertyUrl       String?             // es. "https://www.example.com/" o "sc-domain:example.com"
  propertyType      String?             // "URL_PREFIX" | "DOMAIN"
  
  // Status
  status            String   @default("active") // "active" | "revoked" | "error"
  lastSyncAt        DateTime?
  lastSyncError     String?
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  project           Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user              User     @relation(fields: [userId], references: [id])
  
  @@map("gsc_connections")
}
```

### 4.2 Nuova tabella: `gsc_query_data`

Contiene i dati sincronizzati dalla GSC API. Ogni riga = una query + una combinazione di filtri per un periodo.

```prisma
model GscQueryData {
  id              String   @id @default(cuid())
  projectId       String
  
  // Dati dalla GSC API
  query           String              // la query di ricerca
  page            String?             // landing page (URL)
  country         String?             // ISO 3166-1 alpha-3 (GSC usa alpha-3)
  device          String?             // "DESKTOP" | "MOBILE" | "TABLET"
  
  // Metriche
  clicks          Int      @default(0)
  impressions     Int      @default(0)
  ctr             Float    @default(0)
  position        Float    @default(0)  // posizione media
  
  // Periodo
  dateStart       DateTime            // inizio periodo aggregato
  dateEnd         DateTime            // fine periodo aggregato
  syncBatchId     String              // per tracciare quale sync ha importato questi dati
  
  // Classificazione intento (calcolata dopo sync)
  intentType      String?             // "informational" | "comparative" | "decisional" | "navigational" | "conversational_ai"
  intentScore     Float?              // confidenza della classificazione (0-1)
  isLongQuery     Boolean  @default(false) // query con 6+ parole (proxy per AI query)
  
  createdAt       DateTime @default(now())
  
  project         Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  @@unique([projectId, query, country, device, dateStart, dateEnd])
  @@index([projectId, impressions(sort: Desc)])
  @@index([projectId, intentType])
  @@index([projectId, isLongQuery])
  @@map("gsc_query_data")
}
```

### 4.3 Nuova tabella: `intent_profiles`

Profili di intento derivati dall'analisi dei cluster di query GSC.

```prisma
model IntentProfile {
  id              String   @id @default(cuid())
  projectId       String
  
  // Identificazione
  name            String              // es. "Technical Evaluator", "Quick Researcher"
  slug            String              // es. "technical-evaluator"
  description     String?             // generata, descrizione del profilo
  
  // Caratteristiche derivate dai dati
  dominantIntent  String              // "informational" | "comparative" | "decisional"
  dominantDevice  String?             // "DESKTOP" | "MOBILE" (>60% del cluster)
  dominantCountry String?             // ISO alpha-3 (>60% del cluster)
  avgQueryLength  Float               // lunghezza media query nel cluster
  queryCount      Int                 // quante query nel cluster
  totalImpressions Int                // impression totali del cluster
  
  // Keyword patterns nel cluster
  topPatterns     Json                // es. ["vs", "migliore", "come"] — top 5 pattern
  sampleQueries   Json                // es. ["CRM vs Salesforce", "miglior CRM startup"] — 5 query esempio
  
  // Contesto per citation check
  contextPrompt   String?             // system prompt addendum per simulare questo profilo
                                      // es. "L'utente sta confrontando CRM, ha già cercato 'Salesforce pricing'"
  
  // Stato
  isActive        Boolean  @default(true)
  generatedAt     DateTime @default(now())
  
  project         Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  // Relazione con le varianti di citation check
  citationVariants CitationCheckVariant[]
  
  @@unique([projectId, slug])
  @@map("intent_profiles")
}
```

### 4.4 Nuova tabella: `citation_check_variants`

Estende il citation check esistente con varianti di contesto.

```prisma
model CitationCheckVariant {
  id                  String   @id @default(cuid())
  citationCheckId     String              // FK al CitationCheck originale
  intentProfileId     String              // quale profilo ha generato questa variante
  
  // Risultati della variante
  userCited           Boolean  @default(false)
  userCitedPosition   Int?
  userCitedSegment    String?
  citedSources        Json?               // stessa struttura di CitationCheck.citedSources
  responseText        String?
  searchQueries       Json?               // fan-out interno usato da Gemini
  
  // Il contesto usato per questa variante
  contextPromptUsed   String              // il system prompt effettivamente usato
  
  createdAt           DateTime @default(now())
  
  citationCheck       CitationCheck    @relation(fields: [citationCheckId], references: [id], onDelete: Cascade)
  intentProfile       IntentProfile    @relation(fields: [intentProfileId], references: [id], onDelete: Cascade)
  
  @@unique([citationCheckId, intentProfileId])
  @@map("citation_check_variants")
}
```

### 4.5 Relazione con il CitationCheck esistente

Aggiungere alla model `CitationCheck` esistente:

```prisma
// Aggiungere questo campo alla model CitationCheck esistente:
model CitationCheck {
  // ... campi esistenti ...
  
  variants CitationCheckVariant[]  // AGGIUNGERE questa relazione
}
```

### 4.6 Nuova tabella: `gsc_query_suggestions`

Query suggerite dall'analisi GSC per essere aggiunte come target.

```prisma
model GscQuerySuggestion {
  id              String   @id @default(cuid())
  projectId       String
  
  query           String              // la query suggerita
  reason          String              // perché viene suggerita
  intentType      String              // intento classificato
  impressions     Int                 // impression totali nel periodo
  clicks          Int                 // click totali
  avgPosition     Float               // posizione media
  
  // Matching con query target esistenti
  matchedTargetQueryId  String?       // se simile a una query target esistente
  similarityScore       Float?        // cosine similarity con la query target più vicina
  
  // Stato
  status          String   @default("pending") // "pending" | "accepted" | "dismissed"
  
  createdAt       DateTime @default(now())
  
  project         Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  @@unique([projectId, query])
  @@map("gsc_query_suggestions")
}
```

### 4.7 Migrazione — ordine di creazione

```bash
# Eseguire in questo ordine:
npx prisma migrate dev --name add_gsc_connections
npx prisma migrate dev --name add_gsc_query_data
npx prisma migrate dev --name add_intent_profiles
npx prisma migrate dev --name add_citation_check_variants
npx prisma migrate dev --name add_gsc_query_suggestions
```

Oppure in un'unica migrazione se si preferisce:
```bash
npx prisma migrate dev --name gsc_integration
```

---

## 5. Nuovi Job Types

Aggiungere al type union esistente:

```
'gsc_sync'                 → Pull dati da GSC API per un progetto
'intent_classification'    → Classifica query e genera Intent Profiles
'citation_check_enriched'  → Citation check con varianti di contesto
```

### 5.1 Job: `gsc_sync`

**Trigger**: dopo che l'utente collega GSC + seleziona proprietà. Poi settimanale (o manuale da UI).

**Input** (job metadata):
```json
{
  "projectId": "clxxx...",
  "syncType": "initial" | "incremental",
  "dateRange": {
    "startDate": "2025-12-28",
    "endDate": "2026-03-28"
  }
}
```

**Steps** (per StepLoader):
1. "Connessione a Google Search Console"
2. "Download dati query (ultimi 90 giorni)" / "Download dati query (ultima settimana)"
3. "Classificazione intento delle query"
4. "Identificazione query suggerite"
5. "Sincronizzazione completata"

**Logica** (in `gsc_sync.py`):
```
1. Leggi gsc_connections per il progetto → ottieni refresh_token
2. Rinnova access_token se scaduto (POST https://oauth2.googleapis.com/token)
3. Chiama GSC API searchAnalytics.query:
   - dimensions: ["query", "page", "country", "device"]
   - dateRange: ultimi 90gg (initial) o ultimi 7gg (incremental)
   - rowLimit: 5000 (massimo consentito dall'API)
   - Se servono più righe: paginare con startRow
4. Per ogni riga: upsert in gsc_query_data
5. Marca query con isLongQuery = True se word_count >= 6
6. Classifica intento (vedi §6.2)
7. Genera query suggestions (vedi §6.3)
8. Aggiorna gsc_connections.lastSyncAt
```

### 5.2 Job: `intent_classification`

**Trigger**: automatico dopo `gsc_sync`. Può anche essere triggerato manualmente.

**Input**:
```json
{
  "projectId": "clxxx...",
  "forceRegenerate": false
}
```

**Steps** (per StepLoader):
1. "Analisi pattern delle query"
2. "Classificazione intento"
3. "Clustering per profili"
4. "Generazione contesti per citation check"
5. "Profili pronti"

**Logica** (in `intent_engine.py`, dettaglio in §6).

### 5.3 Job: `citation_check_enriched`

**Trigger**: quando l'utente avvia una citation simulation E il progetto ha intent profiles attivi.

**Input**:
```json
{
  "projectId": "clxxx...",
  "targetQueryId": "clyyy...",
  "includeVariants": true,
  "maxVariants": 3
}
```

**Steps** (per StepLoader):
1. "Simulazione citazione (contesto generico)"
2. "Simulazione citazione (profilo: [nome profilo 1])"
3. "Simulazione citazione (profilo: [nome profilo 2])"
4. "Confronto risultati"
5. "Analisi completata"

**Logica**: uguale al citation_check esistente, ma ripetuta per ogni variante di contesto. Dettaglio in §7.

---

## 6. Motore di classificazione intento (Python)

### 6.1 Nuovo file: `intent_engine.py`

Posizione: nel microservizio FastAPI, stesso livello di `scoring.py`, `citation_check.py`, etc.

### 6.2 Classificazione intento — euristica

La classificazione è EURISTICA (coerente con AD-02). Nessun LLM nel loop di classificazione.

```python
# intent_engine.py — pseudocodice dettagliato

import re
from typing import Literal

IntentType = Literal[
    "informational",    # "come funziona X", "cosa è Y"
    "comparative",      # "X vs Y", "migliore X per Y", "alternativa a X"
    "decisional",       # "quale X scegliere", "prezzo X", "comprare X"
    "navigational",     # brand name, "login X", "sito X"
    "conversational_ai" # query lunghe, conversazionali (proxy AI Mode)
]

# Pattern per lingua italiana + inglese
INTENT_PATTERNS = {
    "informational": {
        "it": [
            r"\bcome\s+(funziona|fare|si\s+fa)\b",
            r"\bcos[a']?\s+(è|sono)\b",
            r"\bperch[eé]\b",
            r"\bquando\b",
            r"\bguida\b",
            r"\btutorial\b",
            r"\bspiegazione\b",
            r"\bdifferenza\s+tra\b",
        ],
        "en": [
            r"\bhow\s+to\b",
            r"\bwhat\s+is\b",
            r"\bwhy\b",
            r"\bguide\b",
            r"\btutorial\b",
            r"\bexplain\b",
            r"\bdifference\s+between\b",
        ]
    },
    "comparative": {
        "it": [
            r"\bvs\.?\b",
            r"\bversus\b",
            r"\bmiglior[ei]?\b",
            r"\balternativ[ae]\s+a\b",
            r"\bconfronto\b",
            r"\bcomparazione\b",
            r"\bo\b.+\bo\b",  # "X o Y" pattern
            r"\btop\s+\d+\b",
        ],
        "en": [
            r"\bvs\.?\b",
            r"\bversus\b",
            r"\bbest\b",
            r"\balternative\s+to\b",
            r"\bcompare\b",
            r"\bcomparison\b",
            r"\btop\s+\d+\b",
            r"\bor\b.+\bor\b",
        ]
    },
    "decisional": {
        "it": [
            r"\bquale\b.+\bscegliere\b",
            r"\bprezzo\b",
            r"\bcosto\b",
            r"\bcomprare\b",
            r"\bacquistare\b",
            r"\babbonam\w+\b",
            r"\bprova\s+gratuita\b",
            r"\bdemo\b",
        ],
        "en": [
            r"\bwhich\b.+\bchoose\b",
            r"\bprice\b",
            r"\bcost\b",
            r"\bbuy\b",
            r"\bpurchase\b",
            r"\bsubscri\w+\b",
            r"\bfree\s+trial\b",
            r"\bdemo\b",
            r"\bnear\s+me\b",
        ]
    },
    "navigational": {
        "both": [
            r"\blogin\b",
            r"\bsign\s*(in|up)\b",
            r"\baccedi\b",
            r"\bregistra\w*\b",
            r"\bsito\s+ufficiale\b",
            r"\bofficial\s+site\b",
            r"\bdownload\b",
        ]
    }
}

def classify_intent(
    query: str,
    target_language: str,  # "it" | "en"
    brand_name: str         # per navigational detection
) -> tuple[IntentType, float]:
    """
    Classifica l'intento di una query.
    Returns: (intent_type, confidence_score 0-1)
    """
    query_lower = query.lower().strip()
    word_count = len(query_lower.split())
    
    # 1. Query conversazionale/AI (6+ parole, pattern colloquiale)
    if word_count >= 8:
        return ("conversational_ai", 0.85)
    if word_count >= 6 and any(
        query_lower.startswith(p) for p in 
        ["come posso", "qual è il modo", "mi puoi", "vorrei sapere",
         "how can i", "what's the best way", "i want to", "can you"]
    ):
        return ("conversational_ai", 0.90)
    
    # 2. Navigational (contiene brand name)
    if brand_name.lower() in query_lower:
        nav_patterns = INTENT_PATTERNS["navigational"]["both"]
        if any(re.search(p, query_lower) for p in nav_patterns):
            return ("navigational", 0.95)
        # Solo brand name senza pattern → probabilmente navigational
        if word_count <= 3:
            return ("navigational", 0.80)
    
    # 3. Pattern matching per gli altri intenti
    scores = {}
    lang_key = target_language if target_language in ("it", "en") else "en"
    
    for intent, patterns_by_lang in INTENT_PATTERNS.items():
        if intent == "navigational":
            continue
        lang_patterns = patterns_by_lang.get(lang_key, []) + patterns_by_lang.get("both", [])
        match_count = sum(1 for p in lang_patterns if re.search(p, query_lower))
        if match_count > 0:
            scores[intent] = min(0.60 + (match_count * 0.15), 0.95)
    
    if scores:
        best_intent = max(scores, key=scores.get)
        return (best_intent, scores[best_intent])
    
    # 4. Default: informational (la maggior parte delle query lo sono)
    return ("informational", 0.50)
```

### 6.3 Generazione query suggestions

```python
# In intent_engine.py

def generate_query_suggestions(
    project_id: str,
    gsc_queries: list[GscQueryData],
    existing_target_queries: list[str],
    target_language: str,
    voyage_client  # per embedding similarity
) -> list[dict]:
    """
    Identifica query GSC che dovrebbero essere aggiunte come query target.
    
    Criteri per suggerire una query:
    1. Ha almeno 50 impression nel periodo
    2. Non è navigational
    3. Non è già una query target (o molto simile a una)
    4. È rilevante per il business (intento informational, comparative, o decisional)
    """
    suggestions = []
    
    # Filtra query candidabili
    candidates = [
        q for q in gsc_queries
        if q.impressions >= 50
        and q.intentType != "navigational"
        and q.intentType is not None
    ]
    
    # Ordina per impression decrescenti
    candidates.sort(key=lambda q: q.impressions, reverse=True)
    
    # Calcola embedding delle query target esistenti (batch)
    if existing_target_queries:
        target_embeddings = voyage_client.embed(
            existing_target_queries, 
            input_type="query"
        )
    
    for candidate in candidates[:50]:  # max 50 candidati
        # Calcola similarità con query target esistenti
        if existing_target_queries:
            candidate_embedding = voyage_client.embed(
                [candidate.query], 
                input_type="query"
            )
            max_similarity = max(
                cosine_similarity(candidate_embedding, te) 
                for te in target_embeddings
            )
            matched_query_idx = argmax(similarities)
        else:
            max_similarity = 0.0
            matched_query_idx = None
        
        # Se troppo simile a una query target esistente → skip
        if max_similarity > 0.88:
            continue
        
        # Determina il motivo della suggestione
        if candidate.isLongQuery:
            reason = "query_ai_mode"  # Probabile query da AI Mode
        elif candidate.intentType == "comparative":
            reason = "high_commercial_intent"
        elif candidate.impressions > 200:
            reason = "high_visibility"
        else:
            reason = "coverage_gap"
        
        suggestions.append({
            "query": candidate.query,
            "reason": reason,
            "intentType": candidate.intentType,
            "impressions": candidate.impressions,
            "clicks": candidate.clicks,
            "avgPosition": candidate.position,
            "matchedTargetQueryId": (
                existing_target_queries[matched_query_idx] 
                if matched_query_idx and max_similarity > 0.60 
                else None
            ),
            "similarityScore": max_similarity if max_similarity > 0.60 else None
        })
    
    return suggestions[:20]  # max 20 suggerimenti
```

### 6.4 Generazione Intent Profiles

```python
# In intent_engine.py

def generate_intent_profiles(
    project_id: str,
    gsc_queries: list[GscQueryData],
    brand_name: str,
    target_language: str
) -> list[dict]:
    """
    Genera 2-4 Intent Profiles basati sui cluster di query GSC.
    
    Ogni profilo rappresenta un "tipo di utente" derivato dai pattern 
    di ricerca reali. Viene usato per arricchire il citation check.
    """
    
    # 1. Raggruppa per intento dominante
    intent_groups = {}
    for q in gsc_queries:
        if q.intentType and q.intentType != "navigational":
            if q.intentType not in intent_groups:
                intent_groups[q.intentType] = []
            intent_groups[q.intentType].append(q)
    
    profiles = []
    
    # 2. Per ogni gruppo con almeno 10 query, crea un profilo
    for intent_type, queries in intent_groups.items():
        if len(queries) < 10:
            continue
        
        # Calcola statistiche del cluster
        total_impressions = sum(q.impressions for q in queries)
        avg_query_length = sum(len(q.query.split()) for q in queries) / len(queries)
        
        # Device dominante
        device_counts = {}
        for q in queries:
            if q.device:
                device_counts[q.device] = device_counts.get(q.device, 0) + q.impressions
        dominant_device = max(device_counts, key=device_counts.get) if device_counts else None
        dominant_device_pct = (
            device_counts.get(dominant_device, 0) / total_impressions 
            if dominant_device and total_impressions > 0 
            else 0
        )
        
        # Country dominante
        country_counts = {}
        for q in queries:
            if q.country:
                country_counts[q.country] = country_counts.get(q.country, 0) + q.impressions
        dominant_country = max(country_counts, key=country_counts.get) if country_counts else None
        
        # Top pattern (parole frequenti escludendo stopwords)
        # ... (implementazione con Counter + stopwords per lingua)
        
        # Sample queries (top 5 per impression)
        sorted_queries = sorted(queries, key=lambda q: q.impressions, reverse=True)
        sample_queries = [q.query for q in sorted_queries[:5]]
        
        # Nome e descrizione del profilo (basati sull'intento)
        profile_names = {
            "informational": ("Researcher", "Utente in fase di ricerca e apprendimento"),
            "comparative": ("Evaluator", "Utente che confronta opzioni e alternative"),
            "decisional": ("Decision Maker", "Utente pronto a scegliere o acquistare"),
            "conversational_ai": ("AI Explorer", "Utente che usa query conversazionali tipiche di AI Mode")
        }
        name, description = profile_names.get(
            intent_type, 
            ("Generic", "Profilo generico")
        )
        
        # Context prompt per citation check
        context_prompt = _build_context_prompt(
            intent_type=intent_type,
            sample_queries=sample_queries,
            dominant_device=dominant_device,
            target_language=target_language,
            brand_name=brand_name
        )
        
        profiles.append({
            "name": name,
            "slug": name.lower().replace(" ", "-"),
            "description": description,
            "dominantIntent": intent_type,
            "dominantDevice": dominant_device if dominant_device_pct > 0.60 else None,
            "dominantCountry": dominant_country,
            "avgQueryLength": avg_query_length,
            "queryCount": len(queries),
            "totalImpressions": total_impressions,
            "topPatterns": top_patterns[:5],  # top 5 pattern parole
            "sampleQueries": sample_queries,
            "contextPrompt": context_prompt
        })
    
    # Ordina per impression decrescenti, max 4 profili
    profiles.sort(key=lambda p: p["totalImpressions"], reverse=True)
    return profiles[:4]


def _build_context_prompt(
    intent_type: str,
    sample_queries: list[str],
    dominant_device: str | None,
    target_language: str,
    brand_name: str
) -> str:
    """
    Costruisce il system prompt addendum per simulare un utente 
    con questo profilo durante il citation check.
    
    NOTA: questo NON è un prompt di scoring (AD-02 rispettato).
    È un prompt di contesto per la simulazione Gemini Grounding.
    """
    
    lang = "italiano" if target_language == "it" else "English"
    device_context = ""
    if dominant_device == "MOBILE":
        device_context = "The user is searching from a mobile device and expects concise, direct answers."
    elif dominant_device == "DESKTOP":
        device_context = "The user is searching from desktop, likely in a work context, and expects detailed information."
    
    intent_contexts = {
        "informational": (
            f"The user is researching and learning about this topic. "
            f"They have previously searched for: {', '.join(sample_queries[:3])}. "
            f"They want comprehensive, educational information."
        ),
        "comparative": (
            f"The user is actively comparing alternatives. "
            f"They have previously searched for: {', '.join(sample_queries[:3])}. "
            f"They want to understand trade-offs between options."
        ),
        "decisional": (
            f"The user is close to making a decision or purchase. "
            f"They have previously searched for: {', '.join(sample_queries[:3])}. "
            f"They want definitive recommendations and actionable information."
        ),
        "conversational_ai": (
            f"The user is using conversational, natural language queries typical of AI Mode. "
            f"They have previously asked: {', '.join(sample_queries[:3])}. "
            f"They expect a synthesized, comprehensive answer."
        )
    }
    
    context = intent_contexts.get(intent_type, "")
    
    return f"{context} {device_context}".strip()
```

---

## 7. Integrazione con il Citation Check

### 7.1 Come funziona oggi

Il `citation_check.py` attuale:
1. Riceve una `target_query` e i parametri `targetLanguage` + `targetCountry`
2. Invia la query a Gemini con `google_search` grounding
3. Analizza la risposta per trovare se il sito dell'utente è citato
4. Salva il risultato in `CitationCheck`

### 7.2 Come cambia con le varianti di contesto

Il citation check **base** resta identico. Le varianti sono **aggiuntive**.

```python
# In citation_check.py — estensione

async def run_citation_check_enriched(
    target_query: str,
    target_language: str,
    target_country: str,
    user_site_url: str,
    project_id: str,
    intent_profiles: list[IntentProfile]  # max 3
) -> dict:
    """
    Esegue il citation check base + varianti di contesto.
    """
    
    # 1. Citation check BASE (identico all'attuale)
    base_result = await run_citation_check(
        query=target_query,
        target_language=target_language,
        target_country=target_country,
        user_site_url=user_site_url
    )
    
    # Salva in CitationCheck come oggi
    citation_check_id = save_citation_check(base_result, project_id)
    
    # 2. Varianti di contesto (se ci sono intent profiles)
    variants = []
    for profile in intent_profiles[:3]:  # max 3 varianti
        
        # Modifica il system prompt per simulare il contesto
        enriched_system_prompt = _build_enriched_system_prompt(
            base_language=target_language,
            base_country=target_country,
            context_addendum=profile.contextPrompt
        )
        
        variant_result = await run_citation_check(
            query=target_query,
            target_language=target_language,
            target_country=target_country,
            user_site_url=user_site_url,
            system_prompt_override=enriched_system_prompt  # NUOVO parametro
        )
        
        # Salva come CitationCheckVariant
        save_citation_check_variant(
            citation_check_id=citation_check_id,
            intent_profile_id=profile.id,
            result=variant_result,
            context_prompt_used=enriched_system_prompt
        )
        
        variants.append({
            "profileName": profile.name,
            "profileSlug": profile.slug,
            "userCited": variant_result["userCited"],
            "userCitedPosition": variant_result.get("userCitedPosition"),
            "citedSources": variant_result.get("citedSources", [])
        })
    
    return {
        "base": base_result,
        "variants": variants,
        "citationCheckId": citation_check_id
    }


def _build_enriched_system_prompt(
    base_language: str,
    base_country: str,
    context_addendum: str
) -> str:
    """
    Costruisce il system prompt arricchito per la variante.
    Usa il system prompt base del citation check + il contesto del profilo.
    """
    # System prompt base (quello che già usa citation_check.py)
    base_prompt = get_base_citation_system_prompt(base_language, base_country)
    
    # Aggiunge il contesto del profilo
    return f"""{base_prompt}

Additional context about the user performing this search:
{context_addendum}

Consider this user context when generating your response, as it may influence which sources and information are most relevant."""
```

### 7.3 Costo delle varianti

| Scenario | Citation checks per query | Costo per query |
|----------|--------------------------|-----------------|
| Oggi (senza varianti) | 1 | ~$0.01-0.03 |
| Con 2 varianti | 3 (1 base + 2 varianti) | ~$0.03-0.09 |
| Con 3 varianti | 4 (1 base + 3 varianti) | ~$0.04-0.12 |

Per 15 query target con 3 varianti: ~$0.60-1.80 per ciclo di citation check. Sostenibile.

Le varianti sono **opzionali** e attivate solo per utenti con GSC collegato e intent profiles generati. L'utente può disabilitarle dalle Settings.

---

## 8. API Routes Next.js

### 8.1 Nuove API Routes

```
api/gsc/connect          → GET  → Genera URL OAuth e redirect a Google
api/gsc/callback         → GET  → Riceve callback da Google, salva tokens
api/gsc/properties       → GET  → Lista proprietà GSC dell'utente
api/gsc/select-property  → POST → Collega una proprietà al progetto
api/gsc/disconnect       → POST → Disconnette GSC dal progetto
api/gsc/sync             → POST → Trigga job gsc_sync manualmente
api/gsc/status           → GET  → Stato connessione + ultimo sync
api/gsc/suggestions      → GET  → Lista query suggerite
api/gsc/suggestions/[id] → PATCH → Accetta/scarta una suggestion
```

### 8.2 File: `app/api/gsc/connect/route.ts`

```typescript
// Pseudocodice — adattare alle convenzioni del progetto

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth"; // Auth.js v5
import crypto from "crypto";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }
  
  // Verifica che l'utente sia owner del progetto
  // ... (query DB)
  
  // CSRF token
  const csrfToken = crypto.randomBytes(32).toString("hex");
  // Salva csrfToken in un cookie httpOnly temporaneo (10 minuti)
  
  const state = JSON.stringify({
    projectId,
    userId: session.user.id,
    csrf: csrfToken,
  });
  
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${process.env.NEXTAUTH_URL}/api/gsc/callback`,
    response_type: "code",
    scope: GSC_SCOPE,
    access_type: "offline",
    prompt: "consent",  // Forza re-consenso per refresh_token
    state: Buffer.from(state).toString("base64"),
  });
  
  return NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
}
```

### 8.3 File: `app/api/gsc/callback/route.ts`

```typescript
// Pseudocodice

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto"; // funzione di encryption AES-256-GCM

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect("/login");
  }
  
  const code = req.nextUrl.searchParams.get("code");
  const stateB64 = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");
  
  if (error) {
    // Utente ha negato il consenso
    const state = JSON.parse(Buffer.from(stateB64!, "base64").toString());
    return NextResponse.redirect(
      `/app/projects/${state.projectId}/settings?gsc=denied`
    );
  }
  
  // Decodifica e valida state
  const state = JSON.parse(Buffer.from(stateB64!, "base64").toString());
  // Valida CSRF token dal cookie
  // Valida che userId corrisponda alla sessione
  
  // Scambia code per tokens
  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: code!,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXTAUTH_URL}/api/gsc/callback`,
      grant_type: "authorization_code",
    }),
  });
  
  const tokens = await tokenResponse.json();
  
  if (!tokens.access_token || !tokens.refresh_token) {
    return NextResponse.redirect(
      `/app/projects/${state.projectId}/settings?gsc=error`
    );
  }
  
  // Salva tokens criptati nel DB
  await prisma.gscConnection.upsert({
    where: { projectId: state.projectId },
    create: {
      projectId: state.projectId,
      userId: state.userId,
      accessToken: encrypt(tokens.access_token),
      refreshToken: encrypt(tokens.refresh_token),
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      status: "active",
    },
    update: {
      accessToken: encrypt(tokens.access_token),
      refreshToken: encrypt(tokens.refresh_token),
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      status: "active",
      lastSyncError: null,
    },
  });
  
  return NextResponse.redirect(
    `/app/projects/${state.projectId}/settings?gsc=connected`
  );
}
```

### 8.4 Utility: `lib/crypto.ts`

```typescript
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY = Buffer.from(process.env.GSC_TOKEN_ENCRYPTION_KEY!, "hex"); // 32 bytes

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedText.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
```

---

## 9. Componenti UI

### 9.1 Settings del progetto — sezione GSC

**Posizione**: `app/(app)/projects/[projectId]/settings/page.tsx` — nuova sezione dopo i campi `targetLanguage` / `targetCountry`.

**Stato: disconnesso**
```
┌──────────────────────────────────────────────┐
│  Google Search Console                        │
│                                               │
│  Collega Google Search Console per:           │
│  • Scoprire query AI reali per il tuo sito   │
│  • Ricevere suggerimenti di query target      │
│  • Simulazioni di citazione più accurate      │
│                                               │
│  [Collega Google Search Console]  (button)    │
└──────────────────────────────────────────────┘
```

**Stato: connesso, selezione proprietà**
```
┌──────────────────────────────────────────────┐
│  Google Search Console           ✓ Connesso   │
│                                               │
│  Seleziona la proprietà da collegare:         │
│  ┌────────────────────────────────────────┐   │
│  │ ▼ https://www.tuosito.com/ (match!)   │   │
│  │   sc-domain:altrosito.com             │   │
│  └────────────────────────────────────────┘   │
│                                               │
│  [Collega e sincronizza]  (button)            │
└──────────────────────────────────────────────┘
```

**Stato: connesso e sincronizzato**
```
┌──────────────────────────────────────────────┐
│  Google Search Console           ✓ Connesso   │
│                                               │
│  Proprietà: https://www.tuosito.com/         │
│  Ultima sincronizzazione: 2 ore fa            │
│  Query importate: 1.247                       │
│  Profili di intento: 3 attivi                 │
│                                               │
│  [Sincronizza ora]     [Disconnetti]          │
└──────────────────────────────────────────────┘
```

**Componente**: `components/gsc/gsc-connection-card.tsx`
- Usa `SearchableSelect` per la selezione proprietà (componente primitivo esistente)
- Usa `useJobPolling` per monitorare il job `gsc_sync` dopo la prima connessione
- Usa `StepLoader` durante la sincronizzazione

### 9.2 Sezione Queries — suggerimenti GSC

**Posizione**: nella sezione Queries esistente, sopra la lista delle query target.

**Banner condizionale** (visibile solo se ci sono suggerimenti pendenti):
```
┌──────────────────────────────────────────────────────────┐
│  💡 3 nuove query suggerite da Search Console             │
│                                                           │
│  "come scegliere CRM per startup B2B"                    │
│  📊 342 impression · Intento: comparative                 │
│  [Aggiungi come target]  [Ignora]                        │
│                                                           │
│  "alternativa a Salesforce per PMI"                      │
│  📊 189 impression · Intento: comparative                 │
│  [Aggiungi come target]  [Ignora]                        │
│                                                           │
│  "software gestione clienti piccola azienda"             │
│  📊 127 impression · Intento: informational · 🤖 AI query │
│  [Aggiungi come target]  [Ignora]                        │
└──────────────────────────────────────────────────────────┘
```

**Componente**: `components/gsc/gsc-query-suggestions.tsx`
- L'azione "Aggiungi come target" crea un nuovo `TargetQuery` E marca la suggestion come `accepted`
- L'azione "Ignora" marca la suggestion come `dismissed`
- Il badge "🤖 AI query" appare per query con `isLongQuery = true`

### 9.3 Sezione Queries — varianti citation check

**Posizione**: espansione del `CitationCard` esistente, sotto i risultati del citation check base.

Quando il progetto ha intent profiles attivi E il citation check ha varianti:

```
┌──────────────────────────────────────────────────────────┐
│  "come scegliere un CRM per startup"                     │
│                                                           │
│  ● Citato (posizione 3)        Trend: 2/4 settimane     │
│                                                           │
│  ▼ Risultati per profilo utente                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 👤 Researcher        ● Citato  pos. 3              │  │
│  │ 👤 Evaluator          ● Citato  pos. 1  ▲          │  │
│  │ 👤 Decision Maker     ○ Non citato       ▼          │  │
│  └────────────────────────────────────────────────────┘  │
│                                                           │
│  💡 Il tuo contenuto è visibile per chi sta confrontando  │
│  alternative, ma non per chi è pronto a decidere.        │
│  Suggerimento: aggiungi pricing e CTA al contenuto.      │
└──────────────────────────────────────────────────────────┘
```

**Componente**: `components/gsc/citation-variants-panel.tsx`
- Collassabile (default chiuso)
- L'insight testuale è generato dal Python (LLM, non scoring — coerente con AD-02)

### 9.4 Nuova sezione: Audience Insights

**Posizione**: nuova voce PERMANENTE nel sidebar del progetto, tra "Queries" e "Contents". La voce è sempre visibile indipendentemente dallo stato della connessione GSC. La pagina ha 3 stati.

**Sidebar**: la voce "Audience" appare sempre, con un'icona (es. `Users` da lucide-react). Se GSC non è collegato, nessun badge. Se collegato e con profili, un badge con il numero di profili (es. "3").

#### Stato 1: GSC non collegato (educational + CTA)

Questo è lo stato di default per tutti i progetti nuovi. Lo scopo è spiegare il valore della feature e guidare l'utente al collegamento GSC.

```
┌──────────────────────────────────────────────────────────┐
│  Audience Insights                                       │
│                                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │                                                    │  │
│  │         [icona Users/Search, illustrativa]         │  │
│  │                                                    │  │
│  │  Scopri chi cerca il tuo brand                     │  │
│  │  e come l'AI risponde a ognuno                     │  │
│  │                                                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                           │
│  Google AI Mode personalizza le risposte in base a chi   │
│  cerca. Due persone con la stessa domanda possono        │
│  ricevere fonti diverse.                                 │
│                                                           │
│  Collegando Google Search Console, Visiblee analizza     │
│  le query reali dei tuoi visitatori e identifica i       │
│  profili di intento del tuo pubblico:                    │
│                                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │  👤 Researcher                                     │  │
│  │  Chi sta imparando e cerca informazioni.           │  │
│  │  → Vuole guide, spiegazioni, definizioni.          │  │
│  ├────────────────────────────────────────────────────┤  │
│  │  👤 Evaluator                                      │  │
│  │  Chi confronta opzioni prima di decidere.          │  │
│  │  → Vuole "X vs Y", "migliore X per..."            │  │
│  ├────────────────────────────────────────────────────┤  │
│  │  👤 Decision Maker                                 │  │
│  │  Chi è pronto a scegliere o acquistare.            │  │
│  │  → Vuole pricing, demo, prove gratuite.            │  │
│  ├────────────────────────────────────────────────────┤  │
│  │  👤 AI Explorer                                    │  │
│  │  Chi usa query conversazionali tipiche di AI Mode. │  │
│  │  → Vuole risposte sintetiche e complete.           │  │
│  └────────────────────────────────────────────────────┘  │
│                                                           │
│  Per ogni profilo, Visiblee simula come l'AI risponde    │
│  alla stessa domanda in contesti diversi, così sai       │
│  esattamente per chi sei visibile e per chi no.          │
│                                                           │
│  Servono 2 minuti. I tuoi dati restano privati.          │
│                                                           │
│  [Collega Google Search Console]  (button primario)      │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

**Note implementative per lo Stato 1**:
- Il titolo, la descrizione e le card dei profili sono **statici** (contenuto fisso, non da API). Servono a spiegare il concetto, non a mostrare dati reali.
- Le card dei profili usano uno stile attenuato (opacity ridotta, o bordo tratteggiato) per comunicare "questo è un'anteprima di cosa vedrai".
- Il button "Collega Google Search Console" porta alla stessa URL di `api/gsc/connect?projectId=...` usata nelle Settings.
- Tutte le stringhe sono chiavi i18n (nessun testo hardcoded).

#### Stato 2: GSC collegato, sync in corso o dati insufficienti

```
┌──────────────────────────────────────────────────────────┐
│  Audience Insights                    powered by GSC     │
│                                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │  ✓ Google Search Console collegato                 │  │
│  │                                                    │  │
│  │  [StepLoader: sincronizzazione in corso]           │  │
│  │  oppure                                            │  │
│  │  "Dati insufficienti per generare profili.         │  │
│  │   Servono almeno 10 query con 50+ impression.      │  │
│  │   Riprova tra qualche settimana."                  │  │
│  └────────────────────────────────────────────────────┘  │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

**Note implementative per lo Stato 2**:
- Se il job `gsc_sync` è in corso: mostrare `StepLoader` con i passi standard (usa `useJobPolling`)
- Se il sync è completato ma non ci sono abbastanza dati per generare profili (es. sito nuovo con poco traffico): mostrare messaggio informativo, non un errore. Tono: "il tuo sito sta crescendo, torneremo a controllare."
- Non mostrare le card dei profili statiche (quelle sono per lo Stato 1 educational)

#### Stato 3: GSC collegato, profili disponibili (stato pieno)

```
┌──────────────────────────────────────────────────────────┐
│  Audience Insights                    powered by GSC     │
│                                                           │
│  Il tuo pubblico in 3 profili                            │
│                                                           │
│  ┌─────────────────────────────────────────────────┐     │
│  │  👤 Evaluator (42% del traffico)                 │     │
│  │  Intento: comparative · Device: 78% desktop      │     │
│  │  Pattern: "vs", "migliore", "confronto"          │     │
│  │  Query esempio: "CRM vs Salesforce per PMI"      │     │
│  │                                                   │     │
│  │  Citation impact:                                 │     │
│  │  Citato per 4/5 query target ██████████░░ 80%    │     │
│  └─────────────────────────────────────────────────┘     │
│                                                           │
│  ┌─────────────────────────────────────────────────┐     │
│  │  👤 Researcher (35% del traffico)                │     │
│  │  Intento: informational · Device: 62% mobile     │     │
│  │  Pattern: "come", "guida", "cosa è"              │     │
│  │  Query esempio: "come funziona CRM cloud"        │     │
│  │                                                   │     │
│  │  Citation impact:                                 │     │
│  │  Citato per 2/5 query target ████░░░░░░░░ 40%    │     │
│  └─────────────────────────────────────────────────┘     │
│                                                           │
│  ┌─────────────────────────────────────────────────┐     │
│  │  👤 AI Explorer (23% del traffico)               │     │
│  │  Intento: conversational · Device: 55% mobile    │     │
│  │  Pattern: query lunghe e conversazionali          │     │
│  │  Query esempio: "qual è il CRM più adatto..."    │     │
│  │                                                   │     │
│  │  Citation impact:                                 │     │
│  │  Citato per 1/5 query target ██░░░░░░░░░░ 20%    │     │
│  └─────────────────────────────────────────────────┘     │
│                                                           │
│  Ultima sincronizzazione GSC: 2 ore fa                   │
│  [Sincronizza ora]                                       │
└──────────────────────────────────────────────────────────┘
```

**Componente**: `components/gsc/audience-insights-page.tsx`

Logica dei 3 stati:
```typescript
// Pseudocodice per la logica degli stati
const gscConnection = await getGscConnection(projectId);
const intentProfiles = await getIntentProfiles(projectId);
const pendingJob = await getPendingJob(projectId, "gsc_sync");

if (!gscConnection || gscConnection.status !== "active") {
  // STATO 1: educational + CTA
  return <AudienceInsightsEmpty />;
}

if (pendingJob || intentProfiles.length === 0) {
  // STATO 2: sync in corso o dati insufficienti
  if (pendingJob) {
    return <AudienceInsightsSyncing jobId={pendingJob.id} />;
  }
  return <AudienceInsightsNoData lastSyncAt={gscConnection.lastSyncAt} />;
}

// STATO 3: profili disponibili
return <AudienceInsightsProfiles profiles={intentProfiles} />;
```

**Sub-componenti**:
- `AudienceInsightsEmpty` — contenuto educational statico con CTA. Nessuna chiamata API necessaria.
- `AudienceInsightsSyncing` — `StepLoader` + `useJobPolling` per il job in corso.
- `AudienceInsightsNoData` — messaggio informativo con data ultimo sync.
- `AudienceInsightsProfiles` — card reali con dati dai profili + citation impact.

---

## 10. Variabili d'ambiente

Aggiungere a `.env` / `.env.local`:

```bash
# Google Search Console integration
# Usa lo STESSO client ID/secret del login Google OAuth
# (già presenti come GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET)

# Encryption key per i token OAuth GSC (generare con: openssl rand -hex 32)
GSC_TOKEN_ENCRYPTION_KEY=<64 caratteri hex>

# Feature flag (per rollout graduale)
NEXT_PUBLIC_GSC_ENABLED=true
```

Aggiungere al Python microservice `.env`:

```bash
# Connessione al DB per leggere i token GSC
DATABASE_URL=<stessa stringa del Next.js>

# Encryption key (stessa del Next.js per decrittare i token)
GSC_TOKEN_ENCRYPTION_KEY=<64 caratteri hex — stessa del Next.js>
```

---

## 11. Dipendenze Python

Aggiungere al `requirements.txt` del microservizio:

```
google-api-python-client>=2.0.0
google-auth>=2.0.0
google-auth-oauthlib>=1.0.0
cryptography>=41.0.0  # per AES-256-GCM (se non usi pycryptodome)
```

---

## 12. Piano di implementazione — Tasks atomici

### Fase A: Foundation (1-2 giorni)

**Task A1**: Schema DB + migrazione
- Creare le 5 nuove tabelle in `schema.prisma`
- Aggiungere relazione `variants` a `CitationCheck`
- Eseguire migrazione
- Verificare: `npx prisma studio` mostra le nuove tabelle

**Task A2**: Crypto utility
- Creare `lib/crypto.ts` con `encrypt()` e `decrypt()`
- Creare corrispondente `crypto_utils.py` nel Python (stesso algoritmo!)
- Verificare: encrypt in TS → decrypt in Python funziona (e viceversa)

**Task A3**: Variabili d'ambiente
- Generare `GSC_TOKEN_ENCRYPTION_KEY`
- Aggiungere a `.env.local` (Next.js) e `.env` (Python)
- Aggiungere `NEXT_PUBLIC_GSC_ENABLED=true`
- Aggiungere a `.env.example` con placeholder

### Fase B: OAuth Flow (1-2 giorni)

**Task B1**: API Route `/api/gsc/connect`
- Implementare redirect a Google OAuth
- Includere CSRF protection via state parameter
- Verificare: cliccando il link si arriva alla consent screen Google

**Task B2**: API Route `/api/gsc/callback`
- Implementare token exchange
- Salvare tokens criptati nel DB
- Gestire errori (denied, missing refresh_token)
- Verificare: dopo consenso, `gsc_connections` ha una riga con tokens criptati

**Task B3**: API Route `/api/gsc/properties`
- Chiamare GSC API `sites.list` usando access_token
- Refresh automatico se scaduto
- Restituire lista proprietà con match highlight sull'URL del progetto
- Verificare: restituisce la lista delle proprietà GSC dell'utente

**Task B4**: API Route `/api/gsc/select-property` + `/api/gsc/disconnect`
- POST per salvare `propertyUrl` + triggare primo `gsc_sync` job
- POST per cancellare connessione + dati GSC
- Verificare: selezionare proprietà crea job in tabella `jobs`

### Fase C: GSC Sync (2-3 giorni)

**Task C1**: `gsc_sync.py` — data pull
- Implementare refresh token flow in Python
- Chiamare `searchAnalytics.query` con paginazione
- Upsert risultati in `gsc_query_data`
- Verificare: dopo il job, `gsc_query_data` ha righe con dati reali

**Task C2**: `intent_engine.py` — classificazione intento
- Implementare `classify_intent()` con pattern matching
- Classificare tutte le query in `gsc_query_data` dopo sync
- Verificare: le righe hanno `intentType` popolato

**Task C3**: `intent_engine.py` — query suggestions
- Implementare `generate_query_suggestions()`
- Salvare in `gsc_query_suggestions`
- Verificare: suggerimenti generati con reason e intent

**Task C4**: `intent_engine.py` — Intent Profiles
- Implementare `generate_intent_profiles()`
- Salvare in `intent_profiles`
- Verificare: 2-4 profili generati con `contextPrompt`

**Task C5**: Worker endpoint FastAPI
- Aggiungere endpoint `POST /jobs/gsc_sync` nel router FastAPI
- Implementare step reporting per `StepLoader`
- Verificare: job completo end-to-end, `StepLoader` mostra i passi

### Fase D: Citation Check Enrichment (1-2 giorni)

**Task D1**: Estendere `citation_check.py`
- Aggiungere parametro `system_prompt_override` a `run_citation_check()`
- Implementare `run_citation_check_enriched()` che chiama base + varianti
- Verificare: per una query, ottenere 1 base + N varianti

**Task D2**: Worker endpoint per `citation_check_enriched`
- Aggiungere endpoint o estendere l'endpoint esistente
- Se `includeVariants=true` e ci sono intent profiles → eseguire varianti
- Salvare `CitationCheckVariant` nel DB
- Verificare: varianti salvate con risultati diversi dal base

### Fase E: UI (2-3 giorni)

**Task E1**: `GscConnectionCard` nelle Settings
- Componente con 3 stati: disconnesso / selezione proprietà / connesso
- Usa `SearchableSelect` per proprietà
- Usa `useJobPolling` per sync
- Verificare: flow completo connect → select → sync visibile

**Task E2**: `GscQuerySuggestions` nella sezione Queries
- Banner condizionale con suggerimenti
- Azioni accetta/ignora
- Badge "AI query" per query lunghe
- Verificare: suggerimenti visibili, azioni funzionanti

**Task E3**: `CitationVariantsPanel` nel CitationCard
- Sezione collassabile sotto i risultati base
- Mostra risultato per profilo con indicatori
- Verificare: varianti visibili quando presenti

**Task E4**: `AudienceInsightsPage` con 3 stati
- Aggiungere voce "Audience" nel sidebar del progetto (sempre visibile, tra "Queries" e "Contents")
- Implementare 3 sub-componenti:
  - `AudienceInsightsEmpty` — contenuto educational statico + CTA "Collega GSC" (Stato 1)
  - `AudienceInsightsSyncing` — `StepLoader` + `useJobPolling` per sync in corso (Stato 2a)
  - `AudienceInsightsNoData` — messaggio informativo se dati insufficienti (Stato 2b)
  - `AudienceInsightsProfiles` — card reali con profili + citation impact (Stato 3)
- Logica di routing tra stati: basata su `gscConnection.status`, `pendingJob`, `intentProfiles.length`
- Verificare:
  - Progetto senza GSC → vede pagina educational con CTA funzionante
  - Progetto con GSC appena collegato → vede StepLoader durante sync
  - Progetto con GSC e dati → vede profili reali con dati corretti
  - Progetto con GSC ma poco traffico → vede messaggio "dati insufficienti"

### Fase F: i18n (1 giorno)

**Task F1**: Traduzioni EN + IT
- Aggiungere tutte le chiavi i18n per la nuova sezione
- Nessuna stringa hardcoded (vincolo non negoziabile)
- File: `messages/en/gsc.json` e `messages/it/gsc.json`
- Verificare: switch lingua mostra traduzioni corrette

---

## 13. Criteri di verifica end-to-end

Al termine dell'implementazione, questi scenari devono funzionare:

**Scenario A — Flow completo (utente che collega GSC)**

1. Utente crea progetto con URL `https://www.example.com`, lingua IT, paese IT
2. Utente clicca "Audience" nel sidebar → vede pagina educational con spiegazione dei profili e CTA "Collega GSC"
3. Clicca CTA → si apre consent screen Google → utente approva
4. Torna alle Settings → vede lista proprietà → seleziona `https://www.example.com/`
5. Parte sync automatico → va in Audience → vede StepLoader con passi di sincronizzazione
6. Dopo sync: Audience mostra "3 profili generati" con card reali (Evaluator, Researcher, AI Explorer)
7. Va nella sezione Queries → vede banner "3 query suggerite da GSC"
8. Accetta una query suggerita → diventa query target
9. Avvia citation check per quella query → StepLoader mostra "Simulazione citazione (contesto generico)" poi "Simulazione citazione (profilo: Evaluator)" etc.
10. Vede risultati: "Citato per Evaluator (pos. 1), Non citato per Decision Maker"
11. Torna in Audience → i profili ora mostrano "Citation impact" aggiornato
12. Disconnette GSC dalle Settings → Audience torna alla pagina educational (Stato 1)

**Scenario B — Utente senza GSC (verifica stato educational)**

1. Utente crea progetto e naviga il prodotto normalmente
2. "Audience" è sempre visibile nel sidebar
3. Cliccando: vede pagina educational con spiegazione chiara di cosa sono i profili
4. Le 4 card esempio (Researcher, Evaluator, Decision Maker, AI Explorer) sono visibili ma in stile "anteprima"
5. CTA "Collega Google Search Console" porta al flow OAuth
6. Il testo è completamente tradotto (switch IT/EN funziona)

**Scenario C — Utente con poco traffico**

1. Utente collega GSC ma il sito ha poche impression
2. Sync completa con successo ma trova < 10 query con 50+ impression
3. Audience mostra messaggio "Dati insufficienti per generare profili" con tono rassicurante
4. Non mostra profili vuoti o parziali — solo il messaggio informativo

---

## 14. Note per lo sviluppatore

- **Primitivi condivisi**: usare SEMPRE `StepLoader` per i job e `useJobPolling` per il polling. Non creare loader custom.
- **i18n**: TUTTE le stringhe utente devono essere chiavi i18n. Nessuna stringa hardcoded nei componenti TSX.
- **Score names nel codice**: usare nomi tecnici (es. `intentType`, `contextPrompt`). I nomi user-friendly solo nei file di traduzione.
- **Errori OAuth**: gestire sempre `invalid_grant` (token revocato) e aggiornare lo stato della connessione.
- **Rate limiting GSC API**: la GSC API ha un limite di ~200 richieste/minuto. Per siti con molte query, implementare paginazione con backoff.
- **Data thresholding**: GSC non restituisce righe con pochissime impression. È normale avere meno dati per siti con poco traffico.
- **Encryption key**: DEVE essere la stessa tra Next.js e Python. Se cambiano, i token esistenti diventano illeggibili.
- **Test**: l'intent classification è euristica e deterministica — è possibile (e consigliato) scrivere unit test con query fixture e expected intent.
