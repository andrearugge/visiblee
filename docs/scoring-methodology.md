# Documento Metodologico degli Algoritmi di Scoring — Visiblee

> **Data**: Marzo 2026
> **Scopo**: documentare le scelte tecniche, la letteratura di riferimento e la motivazione strutturata per ogni componente del sistema di scoring di Visiblee.
> **Audience**: AI Engineers, Data Scientists, product manager tecnici.
> **Stato**: documento di riferimento per l'implementazione corrente. Ogni modifica allo scoring deve partire da qui.

---

## 1. Contesto e motivazione

### 1.1 Il fenomeno AI search

La ricerca basata su AI non è più sperimentale. A marzo 2026, Google AI Overviews appare sul 50-60% delle ricerche US (Google I/O 2025 + Conductor 2026 su 21.9M query) e raggiunge oltre 1 miliardo di utenti mensili in 200+ paesi. Google AI Mode è disponibile per abbonati AI Pro/Ultra in US.

Il cambiamento strutturale è la **separazione tra ranking organico e citazione AI**:

| Periodo | % citazioni AI Overview da top 10 organica | Fonte |
|---|---|---|
| Luglio 2025 | 76% | Ahrefs, 1.9M citazioni |
| Ottobre 2025 | 54% | BrightEdge |
| Febbraio 2026 | 38% | Ahrefs, 863K keyword, 4M URL |
| Febbraio 2026 | 17% | BrightEdge (metodologia diversa) |

Per AI Mode il disaccoppiamento è ancora più marcato: solo il 12% delle citazioni corrisponde alla top 10 organica (Moz, 40K keyword). L'88% delle citazioni AI viene da pagine che l'utente non vedrebbe nei risultati tradizionali.

### 1.2 Gemini 3 e il meccanismo di citazione attuale

A gennaio 2026, Google ha reso Gemini 3 il modello predefinito per le AI Overviews. L'impatto documentato (SE Ranking, 100K keyword):
- 42% dei domini precedentemente citati non appare più.
- 51.7% di nuovi domini ha guadagnato citazioni.
- Numero medio di fonti per risposta: da ~11.5 a ~15 (+32%).
- Solo il 19% delle fonti AI Overview si sovrappone ai primi 10 risultati organici.

Gemini 3 introduce due cambiamenti meccanici documentati:
1. **Entity-level authority evaluation**: valuta l'autorità del brand/entità, non solo del dominio.
2. **Fan-out più aggressivo**: genera più sotto-query e pesca da un pool più ampio.

### 1.3 Il processo end-to-end di AI Mode

Basato sui patent Google e sull'analisi di settore (iPullRank, WordLift, Ekamoira):

1. **Query in arrivo** → recupero del profilo utente (user embedding) per personalizzazione.
2. **Query fan-out** → Gemini decompone la query in 8-12 sotto-query (standard) o centinaia (Deep Search). Nel 28.1% dei casi aggiunge automaticamente l'anno corrente, anche se l'utente non lo ha scritto (Qwairy).
3. **Retrieval** → per ogni sotto-query, recupera documenti dall'indice. Retrieval ibrido: BM25 + dense embeddings + reranking.
4. **Custom corpus** → filtra i passaggi migliori via embedding similarity, crea un mini-database dedicato.
5. **Pairwise ranking** → un LLM confronta i passaggi a coppie per costruire una lista ordinata.
6. **Entity-level evaluation** → Gemini 3 valuta l'autorità dell'entità (brand) dietro ogni contenuto.
7. **Reasoning & synthesis** → sceglie quali passaggi citare, genera la risposta.

**Patent di riferimento:**
- US20240289407A1 — architettura AI Mode
- WO2024064249A1 — query fan-out
- US11769017B1 — custom corpus
- US20250124067A1 — pairwise ranking
- WO2025102041A1 — user embeddings

---

## 2. Principi metodologici

### 2.1 Non esistono formule ufficiali

Nessun patent Google descrive un "punteggio di visibilità AI" calcolabile dall'esterno. Lo scoring di Visiblee misura i **segnali documentati** che predicono la citazione, non replica l'algoritmo interno.

### 2.2 Livelli di evidenza

Ogni scelta metodologica è classificata su tre livelli:

| Livello | Descrizione | Esempi |
|---|---|---|
| **Patent Google** (massima credibilità) | Meccanismi documentati ufficialmente | Fan-out, pairwise ranking, entity-level evaluation |
| **Ricerca empirica** (alta credibilità) | Studi su milioni di citazioni reali | Ahrefs 17M study, Growth Memo 1.2M risposte, Wellows correlations |
| **Interpretazione progettuale** (approssimazione onesta) | Pesi specifici, soglie, composizione | Le soglie di cosine similarity, i pesi dei sub-criteri |

Quando un parametro appartiene al terzo livello, è documentato esplicitamente come tale. È progettato per essere aggiornato tramite backtesting su dati reali della citation verification.

### 2.3 Onestà sulle limitazioni

Le citazioni AI sono probabilistiche. SparkToro (gennaio 2026) ha trovato < 1% di probabilità che ChatGPT produca la stessa lista di brand in due risposte consecutive. Solo il 30% dei brand mantiene visibilità costante tra risposte AI consecutive. Visiblee misura la **citabilità potenziale** e il trend, non garantisce una citazione specifica.

---

## 3. Architettura del sistema

### 3.1 Pipeline a step

La pipeline si compone di tre macro-fasi, ognuna implementata come modulo Python separato nel microservizio FastAPI:

```
DISCOVERY
  └── discovery.py
        ├── Brave Search API (8 ricerche parallele)
        ├── Gemini Grounding per classificazione
        └── Varianti brand + keyword settore

CONTENT FETCH & SEGMENTATION
  ├── fetcher.py
  │     ├── Crawl URL confermati
  │     ├── Estrazione HTML raw + JSON-LD schema markup
  │     ├── Check robots.txt (GPTBot, ClaudeBot, PerplexityBot, Google-Extended)
  │     └── Preservazione HTML per scoring strutturale
  └── segmenter.py
        ├── Segmentazione in passaggi (134-167 parole ottimali)
        ├── Calcolo relative_position (dove si trova nel documento)
        ├── entity_density per passaggio (NER euristico)
        ├── has_statistics, has_source_citation
        └── is_answer_first

SCORING ENGINE
  ├── embeddings.py        → Query Reach (fanout + Voyage AI)
  ├── scoring.py           → Citation Power, Brand Authority, Extractability, Source Authority
  ├── citation_check.py    → Citation Verification (Gemini Grounding)
  ├── competitor_analysis.py → Competitor gap analysis
  └── full_pipeline.py     → Orchestrazione + freshness multiplier + composito
```

### 3.2 Dove viene calcolato cosa

| Componente | Dove | Quando | Costo API |
|---|---|---|---|
| Fan-out generation | scoring.py via Gemini Flash | Ad ogni run di analisi | ~$0.002 per 10 query |
| Embedding query + passaggi | embeddings.py via Voyage AI | Ad ogni run di analisi | ~$0.006 per 1000 token |
| Citation Power heuristics | scoring.py | Ad ogni run di analisi | Zero (euristico) |
| Brand Authority heuristics | scoring.py | Ad ogni run di analisi | Zero (euristico) |
| Extractability heuristics | scoring.py | Ad ogni run di analisi | Zero (euristico) |
| Source Authority heuristics | scoring.py | Ad ogni run di analisi | Zero (euristico) |
| Citation Verification | citation_check.py via Gemini Grounding | Settimanalmente | ~$0.01-0.03 per query |
| Competitor Analysis | competitor_analysis.py | Settimanalmente dopo citation check | Zero (euristico su HTML fetchato) |

### 3.3 Stack tecnologico

- **LLM per fan-out**: Gemini 2.5 Flash (scelta tecnica: Google usa Gemini internamente per il fan-out — usare lo stesso modello produce query sintetiche più coerenti con quelle reali).
- **Embeddings**: Voyage AI `voyage-3-large` con retrieval asimmetrico (`input_type="query"` per le query, `input_type="document"` per i passaggi).
- **Similarity**: cosine similarity calcolata in memoria con NumPy (no roundtrip DB per ogni confronto).
- **Citation verification**: Gemini API con `google_search` grounding (ufficiale, non scraping).

---

## 4. I 5 score in dettaglio

### 4.1 Overview dei pesi e delle correlazioni

| Score (codice) | Nome UI | Peso | Correlazione con citazione | Fonte |
|---|---|---|---|---|
| `fanout_coverage_score` | Query Reach | 30% | r=0.87 (semantic completeness) | Wellows 2026, Patent WO2024064249A1 |
| `citation_power_score` | Citation Power | 25% | r=0.84 (vector alignment) + 44.2% position bias | Wellows 2026, Growth Memo feb 2026 |
| `entity_authority_score` | Brand Authority | 20% | r=0.76 (entity KG density), 4.8x per 15+ entità | Wellows 2026, Digital Applied |
| `extractability_score` | Extractability | 15% | +73% selection boost con structured data | Wellows 2026, Princeton GEO |
| `source_authority_score` | Source Authority | 10% | 3-4x per brand su review/community platform | SE Ranking nov 2025, AIVO mar 2026 |

---

### 4.2 Score 1: Query Reach (`fanout_coverage_score`) — Peso 30%

**Cosa misura**: quanto i contenuti dell'utente coprono il ventaglio di sotto-query che un motore AI genererebbe tramite fan-out sulla query target.

**Perché è il fattore più importante**: il fan-out è il meccanismo fondamentale di AI Mode. Google usa un modello Gemini custom specificamente progettato per generarlo. I dati di Ekamoira confermano: i siti con copertura tematica > 80% mantengono l'85.4% della visibilità AI nonostante il 73% di instabilità nelle query fan-out. La copertura tematica è il segnale stabile, anche quando le query cambiano tra sessioni.

**Pipeline di calcolo:**

Step 1 — Generazione fan-out (Gemini 2.5 Flash): per ogni query target, si generano 10 query sintetiche in 6 categorie:

| Categoria | Descrizione | Esempio |
|---|---|---|
| `related` | Riformulazioni e sinonimi | "CRM per piccole aziende" → "software di gestione clienti PMI" |
| `implicit` | Bisogni informativi sottintesi | → "come organizzare i contatti commerciali" |
| `comparative` | Confronti con alternative | → "CRM vs fogli Excel per startup" |
| `exploratory` | Approfondimenti su sotto-aspetti | → "funzionalità pipeline vendite CRM" |
| `decisional` | Orientate alla scelta | → "quale CRM scegliere per un team di 5 persone" |
| `recent` | Time-sensitive, con anno corrente | → "migliori CRM 2026" |

Con 15 query target × 10 fanout = 150 query sintetiche + 15 query originali = 165 query totali (con il limite operativo corrente).

Step 2 — Embedding (Voyage AI): query e passaggi vengono embeddati tramite `voyage-3-large` con retrieval asimmetrico. Il calcolo avviene in memoria con NumPy (batch embedding, no roundtrip DB per ogni confronto).

Step 3 — Coverage con sistema a fasce (4 tier):

| Fascia | Soglia cosine similarity | Peso nel calcolo | Fonte soglia |
|---|---|---|---|
| Eccellente | ≥ 0.88 | 1.0 | Wellows: 7.3x selection rate |
| Buona | 0.75 – 0.87 | 0.7 | Standard RAG retrieval |
| Debole | 0.60 – 0.74 | 0.3 | Soglia minima di rilevanza |
| Non coperta | < 0.60 | 0.0 | Matching semantico ambiguo |

Step 4 — Formula:

```
query_reach = (
    (n_eccellente × 1.0 + n_buona × 0.7 + n_debole × 0.3) / n_totale_query
) × 100
```

Le query in fascia "debole" appaiono nell'Opportunity Map come quick win — la migliore azione a basso costo è rispondere a queste query nei propri contenuti.

**Stato implementazione v1**: completamente implementato. Fan-out via Gemini Flash, embedding via Voyage AI, 4-tier coverage, salvataggio per-query nel DB per l'Opportunity Map.

**Fonti**: Patent WO2024064249A1; Ekamoira fan-out research; Wellows AI Overview ranking factors; WordLift query fan-out.

---

### 4.3 Score 2: Citation Power (`citation_power_score`) — Peso 25%

**Cosa misura**: quanto ogni passaggio è probabile che venga citato da un motore AI, basato sulle caratteristiche empiriche dei testi effettivamente citati.

**Perché questi criteri**: il passaggio dal vecchio schema (5 criteri Princeton-based: self_containedness, claim_clarity, information_density, completeness, verifiability) ai criteri attuali è motivato dai dati di febbraio-marzo 2026. Growth Memo ha analizzato 1.2 milioni di risposte ChatGPT con 18.012 citazioni verificate (P-Value < 0.0001) e ha identificato i predittori effettivi:

1. La posizione nel documento conta più della qualità intrinseca. Il 44.2% delle citazioni viene dal primo 30% del testo (fenomeno "Lost in the Middle", Liu et al. Stanford, TACL 2024).
2. L'entity density è un predittore forte. I testi citati hanno entity density del 20.6% (vs 5-8% del testo standard).
3. Il linguaggio definito batte il linguaggio vago.
4. Le statistiche con fonte aumentano la citabilità del 37-41% (Princeton GEO + dati empirici).
5. Le heading formulate come domande sono trigger di citazione. Il 78.4% delle citazioni con domande viene da heading H2.

**Sub-criteri con pesi:**

| Sub-criterio | Peso | Metodo | Fonte |
|---|---|---|---|
| Position score | 25% | Primo 30% → 1.0; 30-70% → 0.7; ultimo 30% → 0.55 | Growth Memo, 1.2M risposte ChatGPT |
| Entity density | 20% | % named entities / benchmark 20.6%. NER euristico | Growth Memo, Brown Corpus baseline |
| Statistical specificity | 20% | Pattern matching: numeri + parole di contesto (%, milioni, studio, fonte, secondo) | Princeton GEO (KDD 2024): +37-41% |
| Definiteness | 15% | Assenza hedge words (forse, potrebbe, generalmente). Presenza Definition Lead | Growth Memo |
| Answer-first structure | 10% | Prime 40-60 parole del passaggio = risposta diretta. Pattern: "[Soggetto] è [categoria] che [differenziatore]" | Frase.io, GenOptima |
| Source citation | 10% | Riferimenti a fonti esterne inline nel passaggio | Princeton GEO: "Cite Sources" top strategy |

**Formula per passaggio:**

```
citability = (
    position × 0.25 +
    entity_density × 0.20 +
    statistical_specificity × 0.20 +
    definiteness × 0.15 +
    answer_first × 0.10 +
    source_citation × 0.10
) × 100
```

**Campionamento dei passaggi**: i passaggi nel primo 30% del documento vengono scorati tutti; i passaggi nel 30-70% sono campionati (max 5 più lunghi); l'ultimo 30% è campionato minimalmente (max 3, il summary/conclusione vale).

**Score per contenuto**: media ponderata dei citability score, con peso maggiore per i passaggi nel primo 30%.

**Score per progetto**: media dei citability score di tutti i contenuti confermati.

**Stato implementazione v1**: completamente implementato come euristica pura, zero chiamate LLM. Tutti i sub-criteri calcolati in `scoring.py` tramite pattern matching e analisi testuale.

**Fonti**: Growth Memo; Liu et al. "Lost in the Middle" (TACL 2024); Princeton GEO (KDD 2024); Frase.io AEO guide; GenOptima Definition Lead.

---

### 4.4 Score 3: Brand Authority (`entity_authority_score`) — Peso 20%

**Cosa misura**: quanto il brand è riconosciuto, verificabile e autorevole nell'ecosistema web e nei Knowledge Graph, dal punto di vista dei motori AI.

**Perché è stato riprogettato**: il vecchio "Entity Coherence" misurava coerenza terminologica e co-occorrenza — un segnale reale ma incompleto. Gemini 3 valuta l'autorità a livello di entità. I dati di Wellows mostrano r=0.76 tra entity Knowledge Graph density e citazione AI. Contenuti con 15+ entità connesse hanno 4.8x probabilità di selezione. Dati SE Ranking e AIVO mostrano che brand con profili su review platform (G2, Trustpilot, Capterra) hanno 3x citazioni ChatGPT; brand con presenza Reddit/Quora hanno 4x citazioni.

**Sub-criteri con pesi:**

| Sub-criterio | Peso | Metodo | Fonte |
|---|---|---|---|
| Knowledge Graph presence | 30% | Verifica Wikidata, Wikipedia, Knowledge Panel Google via Brave Search | ChatGPT cita Wikipedia nel 47.9% dei casi |
| Cross-web corroboration | 25% | Rapporto contenuti "mention" (terzi) / contenuti "own" dalla discovery | SE Ranking: 3-4x citazioni per brand con corroborazione esterna |
| Entity density nei contenuti | 20% | Media entità riconosciute per passaggio (NER). Benchmark: 20.6% | Growth Memo, feb 2026 |
| Terminological consistency | 15% | Termini significativi (≥4 caratteri) presenti in ≥2 pagine diverse | WordLift: entity integrity |
| Entity Home strength | 10% | Qualità pagina About + schema Organization con sameAs links a Wikipedia, Wikidata, LinkedIn | Google 2026: Entity Home come riferimento per conflitti |

**Formula:**

```
brand_authority = (
    kg_presence × 0.30 +
    cross_web_corroboration × 0.25 +
    entity_density_avg × 0.20 +
    term_consistency × 0.15 +
    entity_home_strength × 0.10
) × 100
```

**Stato implementazione v2**: implementato come euristica. KG presence calcolata come `max(sameAs_score, wiki_proxy)` dove `wiki_proxy=0.8` se almeno un contenuto confermato ha URL Wikipedia/Wikidata (F.1). Cross-web corroboration calcolata dal rapporto mention/own nella discovery. Entity density calcolata sui passaggi. Terminological consistency calcolata cross-pagina. Entity Home basata su verifica schema JSON-LD nell'HTML fetchato.

**Fonti**: Wellows r=0.76; AIVO GEO data march 2026; SE Ranking nov 2025; LinkSurge entity authority; Google Knowledge Panel changes 2026.

---

### 4.5 Score 4: Extractability (`extractability_score`) — Peso 15%

**Cosa misura**: quanto il contenuto è strutturato per essere facilmente scomposto, estratto e processato dai motori AI, sia a livello di struttura testuale che di markup tecnico.

**Perché include il technical check**: i dati 2026 rendono il technical check imprescindibile. Schema markup: +73% selection rate (Wellows). Author schema: 3x più probabilità di citazione (BrightEdge). FAQ schema: +44% citazioni AI. Contenuti con H2→H3 + bullet point: +40% citation rate vs prosa non strutturata. Contenuti strutturati con elenchi: 3x più probabilità di citazione. Con l'80% dei publisher che bloccano almeno un AI crawler, i brand che rendono i propri contenuti accessibili ai bot AI hanno un vantaggio strutturale.

**Sub-criteri con pesi:**

| Sub-criterio | Peso | Metodo | Fonte |
|---|---|---|---|
| Passage length | 20% | % passaggi nella finestra ottimale 134-167 parole. Range accettabile 100-250. Penalizza < 50 e > 300 | Wellows |
| Answer capsule presence | 20% | Ogni sezione (dopo H2) ha un blocco di 40-60 parole che risponde direttamente | Averi, GenOptima |
| Schema markup | 20% | Presenza Article con author e dateModified, Organization con sameAs, FAQ se Q&A presente | Wellows: +73% selection boost |
| Heading structure | 15% | H2 presenti, formulati come domande | Growth Memo: 78.4% citazioni con domande da heading H2 |
| AI crawler access | 15% | robots.txt non blocca GPTBot, ClaudeBot, PerplexityBot, Google-Extended. HTML5 semantico | Press Gazette: 80% publisher bloccano almeno un crawler |
| Self-reference pollution | 10% | Bassa frequenza di riferimenti relativi ("come detto sopra", "questo", "ciò") che rompono l'autocontenimento | Ricerca RAG: i passaggi devono funzionare in isolamento |

**Formula** (calcolo interamente euristico, zero LLM):

```
extractability = (
    passage_length × 0.20 +
    answer_capsule × 0.20 +
    schema_markup × 0.20 +
    heading_structure × 0.15 +
    ai_crawler_access × 0.15 +
    (1 - self_ref_pollution) × 0.10
) × 100
```

**Nota architetturale**: `fetcher.py` preserva l'HTML originale (non solo il testo estratto) per il parsing JSON-LD e l'analisi struttura DOM. Il robots.txt viene fetchato una volta per dominio.

**Stato implementazione v1**: completamente implementato. Schema markup estratto dal JSON-LD nell'HTML originale. robots.txt verificato a tempo di fetch. `segmenter.py` calcola `relative_position`, `entity_density`, `has_statistics`, `has_source_citation`, `is_answer_first` per ogni passaggio.

**Fonti**: Wellows 134-167 parole e +73% schema; Growth Memo heading as prompt; Quolity AI structure boost; Snezzi structure 3x; GenOptima Definition Lead.

---

### 4.6 Score 5: Source Authority (`source_authority_score`) — Peso 10%

**Cosa misura**: la distribuzione della presenza del brand su canali diversi dal sito principale, pesata per la piattaforma AI target configurata nel progetto.

**Perché il peso è il più basso**: il disaccoppiamento ranking/citazione rende la "presenza" meno importante della "qualità della presenza". Essere su 6 piattaforme con contenuti superficiali vale meno che essere su 2 piattaforme con contenuti profondi e entity-rich.

**Piattaforme monitorate e pesi:**

| Piattaforma | Peso | Note |
|---|---|---|
| Website (proprio) | 1.0 | Sorgente primaria |
| YouTube | 1.0 | Fortemente preferito da Google AI (Ahrefs: most-cited in AIO) |
| LinkedIn | 0.7 | Autorità professionale |
| Medium/Substack | 0.6 | Content authority |
| Wikipedia | 0.5 | Knowledge Graph signal |
| Reddit | 0.4 | Community corroboration |
| News/media | 0.8 | Corroboration esterna ad alta autorità |
| Review platform (G2, Trustpilot) | 0.6 | Social proof e entity corroboration |

**Formula per piattaforma:**

```
platform_score = presence × freshness × quality

presence = min(n_contenuti / 5, 1.0)
freshness = max(0, 1 - (days_since_newest / 365))
quality = proxy basato su word count medio e entity density
```

**Score composito:**

```
source_authority = (Σ platform_score_i × weight_i) / (Σ weight_i) × 100
```

**Stato implementazione v2**: formula P×F×Q completamente implementata. `_load_confirmed_platforms()` restituisce `word_count` e `last_fetched_at` per ogni contenuto confermato. `score_source_authority()` calcola presence/freshness/quality per piattaforma con default neutrali per dati mancanti (freshness=0.7, quality=0.5). Pipeline preview converte l'output di `search_cross_platform()` nel formato arricchito.

**Fonti**: Position Digital piattaforme per motore; Ahrefs YouTube most-cited in AIO; Frase.io platform preferences.

---

## 5. Il moltiplicatore freshness

### 5.1 Razionale

La freshness non è un 6° score perché agisce trasversalmente: un contenuto vecchio è penalizzato indipendentemente dalla sua qualità strutturale.

I dati empirici sono robusti: ConvertMate documenta 3.2x più citazioni per contenuti < 30 giorni. BrightEdge mostra che contenuti aggiornati entro 60 giorni sono 1.9x più citati. Ahrefs (17M citations study) documenta una half-life della visibilità AI compressa a 3-6 mesi. Qwairy ha trovato che i sistemi AI aggiungono automaticamente l'anno corrente nel 28.1% delle sotto-query fan-out — questo bias temporale è strutturalmente incorporato nel retrieval.

### 5.2 Tabella moltiplicatori

| Età del contenuto | Moltiplicatore | Fonte |
|---|---|---|
| < 30 giorni | 1.15 | ConvertMate: 3.2x più citazioni |
| 30-60 giorni | 1.00 | Baseline |
| 60-120 giorni | 0.85 | BrightEdge: 1.9x per < 60gg |
| > 120 giorni | 0.70 | Ahrefs: half-life 3-6 mesi |

### 5.3 Calcolo

Il moltiplicatore viene derivato dalla `dateModified` nello schema Article JSON-LD (se presente) o dalla data dell'ultimo fetch in cui il contenuto è risultato modificato. Se nessuna data è disponibile, si usa il moltiplicatore neutro (1.0) con un warning visibile nell'UI.

Il `freshness_multiplier` a livello di progetto è la media dei moltiplicatori dei singoli contenuti, pesata per il numero di query fan-out che ogni contenuto copre.

**Fonti**: Ahrefs 17M citations freshness; Qwairy freshness e fan-out; ConvertMate freshness data; Averi content refresh flywheel.

---

## 6. Il composite score: AI Readiness Score

### 6.1 Formula

```
raw_score = (
    query_reach × 0.30 +
    citation_power × 0.25 +
    brand_authority × 0.20 +
    extractability × 0.15 +
    source_authority × 0.10
)

freshness_multiplier = calculate_freshness_multiplier(project)

ai_readiness_score = raw_score × freshness_multiplier
```

### 6.2 Interpretazione

| Range | Livello | Significato |
|---|---|---|
| 0–25 | Basso | Il brand è quasi invisibile per i motori AI |
| 26–50 | Sotto la media | Presenza parziale, molti gap critici |
| 51–70 | Nella media | Competitivo su alcune query, migliorabile |
| 71–85 | Sopra la media | Buona visibilità, ottimizzazione fine |
| 86–100 | Eccellente | Tra i più citabili nel proprio settore |

### 6.3 Storico e trend

Il composite score viene salvato ad ogni run di analisi. La UI mostra un grafico storico con cui l'utente può osservare il trend nel tempo. Il trend è il KPI primario del prodotto: uno score stabile in crescita indica miglioramenti reali, non oscillazioni casuali.

---

## 7. Citation Verification (Gemini Grounding)

### 7.1 Scopo

La citation verification chiude il loop tra scoring (citabilità potenziale) e realtà (citazione effettiva). Risponde alla domanda: "Google cita effettivamente il mio brand quando qualcuno cerca [query target]?"

### 7.2 Meccanismo

Si utilizza la Gemini API con `google_search` grounding. Quando attivato, Gemini esegue ricerche web reali e restituisce `groundingMetadata` con dati strutturati.

**Input per ogni query target**: la query viene inviata a Gemini con system prompt che simula l'AI Mode nel mercato target (targetLanguage + targetCountry configurati nel progetto).

**Output strutturato ricevuto:**

| Campo | Tipo | Descrizione |
|---|---|---|
| `response_text` | string | La risposta testuale generata |
| `grounding_chunks` | array | Fonti web usate: `{uri, title}` per ciascuna |
| `grounding_supports` | array | Mapping tra segmenti risposta e fonti specifiche |
| `web_search_queries` | array | Le sotto-query interne eseguite da Gemini (fan-out reale) |

**Output salvato in DB (`CitationCheck`):**

| Campo | Tipo |
|---|---|
| `user_cited` | bool |
| `user_cited_position` | int (posizione tra le fonti, 1-based) |
| `user_cited_segment` | string (testo della risposta dove è citato) |
| `cited_sources` | JSON array `[{url, title, domain, is_user, is_competitor, position, supported_text}]` |
| `search_queries` | JSON array (fan-out interno) |

### 7.3 Frequenza e trend

La citation verification viene eseguita settimanalmente per ogni query target. Il sistema mantiene uno storico a 4 settimane e calcola il trend: "Citato 2/4 settimane" permette all'utente di distinguere le citazioni stabili da quelle episodiche.

### 7.4 Limitazioni

- La Gemini API simula Gemini, non è identica al 100% a ciò che AI Overview mostra in SERP. Le fonti possono differire leggermente.
- Copre solo l'ecosistema Google (AI Mode / AI Overviews). Il coverage multi-platform è pianificato per una release futura.
- Il costo è ~$0.01-0.03 per query per settimana, sostenibile con i limiti del Free tier.

### 7.5 Feedback loop per calibramento score

I dati di citation verification alimentano il calibramento nel tempo: se un contenuto con score alto non viene mai citato, i pesi dei sub-criteri vanno rivisti. Se un contenuto con score basso viene citato, c'è un segnale non catturato. Il sistema è progettato per aggiornare i pesi tramite backtesting su dati reali.

**Fonte**: Google Gemini API Grounding documentation: https://ai.google.dev/gemini-api/docs/google-search

---

## 8. Competitor Analysis

### 8.1 Scopo

Capire perché un competitor viene citato e l'utente no. Non solo chi compete, ma cosa hanno di diverso a livello di struttura del contenuto.

### 8.2 Pipeline automatica (post citation check)

1. Per ogni query target, `citation_check.py` raccoglie le fonti citate che non appartengono all'utente.
2. `competitor_analysis.py` fa fetch di ciascuna pagina concorrente.
3. Analisi con la stessa pipeline dell'utente: entity density, position, schema markup, freshness, heading structure, statistical specificity, answer capsule.
4. Gap report generato per ogni query: confronto strutturato tra il contenuto utente più vicino e il contenuto competitor citato.

### 8.3 Struttura del Gap Report

```
COMPETITOR: example.com
Citato per: "migliore CRM per startup"

PERCHÉ È CITATO (analisi strutturale):
• Answer capsule: Sì (47 parole, subito dopo H2)    TU: No
• Statistiche: 3 con fonte inline                    TU: 0
• Entity density: 22.4%                              TU: 8.1%
• Schema Article: Sì, con author                     TU: No
• Aggiornato: 8 giorni fa                            TU: 94 giorni fa
• Heading H2 come domanda: Sì                        TU: No

AZIONI SUGGERITE (ordinate per impatto):
1. Aggiungi un answer capsule di 40-60 parole dopo l'H2 principale
2. Inserisci almeno 2 statistiche con fonte
3. Aggiungi schema Article con author e dateModified
4. Aggiorna il contenuto (94 giorni fa è oltre la soglia critica di 60 giorni)
```

Il competitor analysis è la principale UVP di Visiblee: non dice solo "il tuo score è 42", dice "ecco cosa ha il competitor che a te manca, e come replicarlo."

---

## 9. Market targeting (targetLanguage + targetCountry)

### 9.1 Razionale

Le AI Overviews operano in modo diverso per mercati diversi. Il fan-out in italiano su query B2B Italian market produce query diverse (e fonti diverse) rispetto alle stesse query in inglese. Ignorare la lingua target significa misurare il segnale sbagliato.

### 9.2 Come targetLanguage e targetCountry influenzano la pipeline

| Modulo | Effetto |
|---|---|
| `discovery.py` | Le ricerche Brave Search usano `country` e `search_lang` basati sul target country/language |
| `scoring.py` (fan-out) | Gemini genera le 10 query sintetiche nella lingua target |
| `citation_check.py` | Il system prompt simula AI Mode nel mercato target (lingua + country) |
| `competitor_analysis.py` | I competitor trovati sono rilevanti per il mercato target (non solo globali) |

### 9.3 Configurazione

I parametri sono impostati nel wizard di onboarding e modificabili nelle Settings del progetto. Sono codici standard: `targetLanguage` (ISO 639-1, es. "it", "en", "de"), `targetCountry` (ISO 3166-1 alpha-2, es. "IT", "US", "DE").

---

## 10. Parametri configurabili

| Parametro | Default | Effetto | Livello di evidenza |
|---|---|---|---|
| `COVERAGE_THRESHOLD_EXCELLENT` | `0.88` | Soglia cosine per copertura eccellente | Empirico (Wellows: 7.3x selection rate) |
| `COVERAGE_THRESHOLD_GOOD` | `0.75` | Soglia cosine per copertura buona | Standard RAG retrieval |
| `COVERAGE_THRESHOLD_WEAK` | `0.60` | Soglia cosine per copertura debole | Soglia minima rilevanza semantica |
| `FANOUT_PER_QUERY` | `10` | Query sintetiche per target query | Interpretazione progettuale |
| `MAX_QUERIES_FREE` | `5` | Query target per progetto Free tier | Cap commerciale |
| `MAX_CONTENTS_FREE` | `20` | Contenuti monitorati per progetto Free | Cap commerciale |
| `FRESHNESS_BOOST_30D` | `1.15` | Moltiplicatore freshness < 30 giorni | Empirico (ConvertMate: 3.2x citazioni) |
| `FRESHNESS_NEUTRAL` | `1.00` | Moltiplicatore freshness 30-60 giorni | Baseline |
| `FRESHNESS_DECAY_120D` | `0.85` | Moltiplicatore freshness 60-120 giorni | Empirico (BrightEdge: 1.9x per < 60gg) |
| `FRESHNESS_PENALTY` | `0.70` | Moltiplicatore freshness > 120 giorni | Empirico (Ahrefs: half-life 3-6 mesi) |
| `ENTITY_DENSITY_BENCHMARK` | `0.206` | Entity density di riferimento (20.6%) | Empirico (Growth Memo, Brown Corpus) |
| `PASSAGE_LENGTH_OPTIMAL_MIN` | `134` | Min parole passaggio ottimale | Empirico (Wellows) |
| `PASSAGE_LENGTH_OPTIMAL_MAX` | `167` | Max parole passaggio ottimale | Empirico (Wellows) |
| `ANSWER_CAPSULE_MIN_WORDS` | `40` | Min parole answer capsule | Empirico (Averi, GenOptima) |
| `ANSWER_CAPSULE_MAX_WORDS` | `60` | Max parole answer capsule | Empirico (Averi, GenOptima) |
| `MAX_PAGES_TO_FETCH` | `8` | Pagine fetchate nella preview | Performance |

I parametri a livello "interpretazione progettuale" sono i candidati primari per il calibramento tramite backtesting sui dati di citation verification.

---

## 11. Limitazioni metodologiche e onestà intellettuale

**Lo score non è il punteggio interno di Google.** È la migliore approssimazione dall'esterno basata sui segnali documentati. Nessun accesso al full custom corpus di Google è possibile dall'esterno.

**Le citazioni AI sono probabilistiche.** SparkToro (gennaio 2026) ha trovato < 1% di probabilità che ChatGPT produca la stessa lista di brand in due risposte consecutive. Solo il 30% dei brand mantiene visibilità costante. Lo score misura citabilità e trend, non garantisce una citazione specifica.

**Il fan-out reale è imprevedibile.** Ekamoira documenta un 73% di instabilità nelle query fan-out tra sessioni. Usare Gemini Flash per generarlo è la migliore approssimazione praticabile, ma non è identico al fan-out reale di AI Mode.

**I pesi sono approssimazioni** basate su correlazioni aggregate. La correlazione di r=0.87 per la semantic completeness non significa che aumentare il Query Reach dell'1% produca l'1% in più di citazioni — le correlazioni sono aggregate e non deterministiche a livello di singolo contenuto.

**La citation verification copre solo Google.** La Gemini API con grounding è ufficiale, legale e affidabile per l'ecosistema Google (AI Mode / AI Overviews). Il coverage di altri motori AI è pianificato per una release futura.

**L'entity density è approssimata.** Il NER euristico usato non ha la precisione di un modello NER dedicato. Per contenuti tecnici o in lingue diverse dall'inglese, l'approssimazione è meno accurata.

**Il competitor analysis si basa su una snapshot.** La pagina del competitor viene fetchata al momento del citation check. Il contenuto può cambiare tra una settimana e l'altra.

---

## 12. Glossario

| Termine | Definizione |
|---|---|
| **AI Mode** | Modalità di ricerca Google che usa Gemini per generare risposte sintetiche con citazioni. Disponibile per abbonati AI Pro/Ultra, in espansione globale. |
| **AI Overview (AIO)** | Riquadro con risposta sintetica generata da AI che appare in cima ai risultati Google. Appare sul 50-60% delle ricerche US. |
| **Answer capsule** | Blocco di 40-60 parole subito dopo un heading H2 che risponde direttamente alla domanda implicita nell'heading. Formato ottimale per la citazione AI. |
| **Asymmetric retrieval** | Tecnica di embedding in cui query e documenti vengono embeddati con tipi diversi (`input_type="query"` vs `input_type="document"`), migliorando la qualità del matching semantico. |
| **Citation Power** | Score che misura la probabilità di citazione di ogni passaggio, basato su caratteristiche empiricamente correlate con le citazioni reali. |
| **Cosine similarity** | Misura della similarità tra due vettori (embedding). Range -1 a 1. In questo contesto, misura la similarità semantica tra una query e un passaggio. |
| **Custom corpus** | Mini-database di passaggi costruito da Google per ogni query, filtrando dall'indice i documenti più rilevanti prima del pairwise ranking. |
| **Definition Lead** | Pattern strutturale in cui un passaggio inizia con una definizione diretta del soggetto: "[Brand] è [categoria] che [differenziatore]". |
| **Entity density** | Percentuale di named entities (nomi propri, brand, persone, strumenti) nel testo. Benchmark per i testi citati: 20.6%. |
| **Entity Home** | La pagina principale di un brand che funziona come punto di riferimento per i Knowledge Graph per risolvere conflitti di identità. Tipicamente: About o homepage. |
| **Fan-out** | Il processo con cui un motore AI decompone una query in 8-12+ sotto-query per recuperare informazioni da angoli diversi. |
| **GEO (Generative Engine Optimization)** | Disciplina emersa nel 2024-2025 per ottimizzare i contenuti per la citazione da parte dei motori AI generativi, distinta dalla SEO tradizionale. |
| **Grounding** | Funzionalità della Gemini API che permette al modello di eseguire ricerche web reali e restituire le fonti usate in formato strutturato. |
| **Knowledge Graph (KG)** | Database di entità e relazioni usato da Google per arricchire i risultati di ricerca. La presenza in Wikidata/Wikipedia è un segnale forte per l'entity authority. |
| **Lost in the Middle** | Fenomeno documentato da Liu et al. (Stanford, TACL 2024): i LLM sottopesano sistematicamente le informazioni posizionate nel mezzo di testi lunghi. |
| **NER (Named Entity Recognition)** | Tecnica di NLP per identificare entità nominate nel testo (persone, organizzazioni, luoghi, prodotti). |
| **Pairwise ranking** | Tecnica di ranking in cui un LLM confronta i passaggi a coppie per costruire una lista ordinata, più accurata del ranking per similarità pura. |
| **Query Reach** | Score che misura la copertura semantica dei contenuti rispetto al ventaglio di sotto-query generabili per le query target. |
| **Self-reference pollution** | Presenza eccessiva di riferimenti anaforici ("questo", "come detto sopra") che rendono un passaggio incomprensibile fuori dal suo contesto — penalizzato nel retrieval RAG. |
| **Share of Model** | La frequenza con cui un brand appare nelle risposte AI a un set di query rilevanti per il suo settore. Metrica pianificata per una release futura. |
| **Source Authority** | Score che misura la distribuzione della presenza del brand su piattaforme diverse dal sito principale, pesata per la piattaforma AI target. |
| **Voyage AI** | Provider di embeddings specializzato in retrieval. Il modello `voyage-3-large` con retrieval asimmetrico è il più accurato per il matching semantico query-documento. |
