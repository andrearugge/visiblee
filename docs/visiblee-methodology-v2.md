# Visiblee — Documento Metodologico degli Algoritmi di Scoring

> **Versione**: 2.0 — Marzo 2026
> **Scopo**: documentare le scelte tecniche, la letteratura di riferimento, e la motivazione strutturata per ogni componente del sistema di scoring di Visiblee.
> **Uso**: documento di riferimento interno per decisioni future sugli algoritmi. Ogni modifica allo scoring deve partire da questo documento.

---

## 1. Contesto: come funziona la ricerca AI nel 2026

### 1.1 Il paradigma attuale

La ricerca basata su AI non è più sperimentale. A marzo 2026:

- **Google AI Overviews** appare sul 50-60% delle ricerche US (fonte: Google I/O 2025 + dati Conductor 2026 su 21.9M query). Raggiunge oltre 1 miliardo di utenti mensili in 200+ paesi.
- **Google AI Mode** è disponibile per abbonati AI Pro/Ultra in US, con espansione globale in corso. Usa Gemini 3 Pro per le query più complesse, con routing automatico del modello.
- **ChatGPT** processa 2.5 miliardi di prompt al giorno. ChatGPT Search è una quota crescente.
- **Perplexity** ha raggiunto 45 milioni di utenti attivi e 780 milioni di query mensili.

Il cambiamento strutturale è la **separazione tra ranking organico e citazione AI**. I dati:

| Periodo | % citazioni AI Overview da top 10 organica | Fonte |
|---|---|---|
| Luglio 2025 | 76% | Ahrefs, 1.9M citazioni |
| Ottobre 2025 | 54% | BrightEdge |
| Febbraio 2026 | 38% | Ahrefs, 863K keyword, 4M URL |
| Febbraio 2026 | 17% | BrightEdge (metodologia diversa) |

Per AI Mode il disaccoppiamento è ancora più marcato: solo il 12% delle citazioni corrisponde alla top 10 organica (Moz, 40K keyword). L'88% delle citazioni AI viene da pagine che l'utente non vedrebbe nei risultati tradizionali.

**Fonti primarie:**
- Ahrefs: https://ahrefs.com/blog/ai-overview-citations-top-10/
- SE Ranking, Gemini 3 impact: https://seranking.com/blog/gemini-3-impact-on-ai-overviews/
- ALM Corp, citation drop analysis: https://almcorp.com/blog/google-ai-overview-citations-drop-top-ranking-pages-2026/
- Search Engine Journal: https://www.searchenginejournal.com/google-ai-overview-citations-from-top-ranking-pages-drop-sharply/568637/

### 1.2 Gemini 3 e il nuovo meccanismo di citazione

A gennaio 2026, Google ha reso Gemini 3 il modello predefinito per le AI Overviews globalmente. L'impatto:

- **42% dei domini** precedentemente citati non appare più nelle AI Overviews (sostituiti).
- **51.7% di nuovi domini** hanno guadagnato citazioni post-Gemini 3.
- Il numero medio di fonti per risposta è passato da ~11.5 a ~15 (+32%).
- Le AI Overviews appaiono più spesso per keyword ad alta difficoltà (difficulty 60-70: da 40.87% a 45.93%).
- Solo il **19% delle fonti AI Overview** si sovrappone ai primi 10 risultati organici (post-fix bug febbraio).

Gemini 3 porta due cambiamenti meccanici documentati:
1. **Entity-level authority evaluation**: valuta l'autorità a livello di brand/entità, non solo di dominio.
2. **Fan-out più aggressivo**: genera più sotto-query e pesca da un pool di fonti più ampio.

**Fonti primarie:**
- SE Ranking, studio su 100K keyword: https://seranking.com/blog/gemini-3-impact-on-ai-overviews/
- Digital Applied, Gemini 3 SEO guide: https://www.digitalapplied.com/blog/google-ai-overviews-gemini-3-seo-strategy-guide
- Search Engine Journal: https://www.searchenginejournal.com/google-ai-overviews-now-powered-by-gemini-3/565987/

### 1.3 Il processo end-to-end di AI Mode/AI Overview

Basato sui patent Google e sull'analisi di settore (iPullRank, WordLift, Ekamoira):

1. **Query in arrivo** → il sistema recupera il profilo utente (user embedding) per personalizzare
2. **Query fan-out** → Gemini decompone la query in 8-12 sotto-query (standard) o centinaia (Deep Search). Le categorie: correlate, implicite, comparative, esplorative, decisionali, recenti. Nel 28.1% dei casi aggiunge automaticamente l'anno corrente ("2026") anche se l'utente non lo ha scritto (dato Qwairy).
3. **Retrieval** → per ogni sotto-query, recupera documenti dall'indice. Usa retrieval ibrido: BM25 (lessicale) + dense embeddings + reranking.
4. **Custom corpus** → filtra i passaggi migliori via embedding similarity, crea un mini-database dedicato.
5. **Pairwise ranking** → un LLM confronta i passaggi a coppie per costruire una lista ordinata.
6. **Entity-level evaluation** → Gemini 3 valuta l'autorità dell'entità (brand) dietro ogni contenuto, non solo il dominio.
7. **Reasoning & synthesis** → il modello ragiona attraverso i passaggi sopravvissuti, sceglie quali citare, genera la risposta.

**Patent di riferimento:**
- US20240289407A1: "Search with stateful chat" — architettura AI Mode
- WO2024064249A1: "Prompt-based query generation for diverse retrieval" — query fan-out
- US11769017B1: "Generative summaries for search results" — custom corpus
- US20250124067A1: "Method for text ranking with pairwise ranking prompting" — pairwise ranking
- WO2025102041A1: "User embedding models for personalization" — user embeddings
- US20240256965A1: "Instruction fine-tuning with intermediate reasoning steps" — reasoning chains

**Fonti di settore:**
- iPullRank, "How AI Mode Works": https://ipullrank.com/how-ai-mode-works
- WordLift, "Query Fan-Out": https://wordlift.io/blog/en/query-fan-out-ai-search/
- WordLift, "Why AI Cites Some Pages": https://wordlift.io/blog/en/embeddings-search-visibility/
- Ekamoira, query fan-out research: https://www.ekamoira.com/blog/query-fan-out-original-research-on-how-ai-search-multiplies-every-query-and-why-most-brands-are-invisible
- Qwairy, freshness e fan-out: https://www.qwairy.co/blog/content-freshness-ai-citations-guide

### 1.4 Le differenze tra piattaforme AI

Le piattaforme AI hanno preferenze di fonte radicalmente diverse. Superlines ha analizzato 34.234 risposte su 10 piattaforme (gennaio-febbraio 2026): i volumi di citazione variano di un fattore 615x tra le piattaforme per lo stesso brand. Solo l'11% dei domini è citato sia da ChatGPT che da Google AI Overviews.

| Piattaforma | Fonte primaria preferita | Dato chiave | Fonte |
|---|---|---|---|
| Google AI Overviews | YouTube (in crescita), siti ad alta authority | YouTube cresciuto 34% in 6 mesi come fonte AIO; solo 19% overlap con top 10 organica | Ahrefs, SE Ranking |
| Google AI Mode | Wikipedia, Quora, pool molto ampio | Solo 12% overlap con top 10; 13.7% overlap con AI Overview | Moz, Ahrefs |
| ChatGPT | Wikipedia (47.9% top citations), siti autorità | Più forte bias di freschezza tra tutte le piattaforme; ordina citazioni da più recente a più vecchio | Ahrefs 17M citations study |
| Perplexity | Reddit (46.7% top sources) | Forte preferenza per contenuti < 90 giorni; real-time indexing | Frase.io, Profound |

**Fonti primarie:**
- Superlines, 60+ statistics: https://www.superlines.io/articles/ai-search-statistics/
- Ahrefs, freshness study (17M citations): https://ahrefs.com/blog/do-ai-assistants-prefer-to-cite-fresh-content/
- Profound, citation patterns: https://www.tryprofound.com/blog/ai-platform-citation-patterns
- Position Digital, 100+ stats: https://www.position.digital/blog/ai-seo-statistics/

---

## 2. Framework di scoring: i 5 score + 1 moltiplicatore

### 2.1 Principio fondamentale

Non esistono formule "ufficiali" nei patent Google per calcolare un punteggio di visibilità AI dall'esterno. Lo scoring di Visiblee è costruito per misurare i **segnali documentati** che predicono la citazione, non per replicare l'algoritmo interno.

Lo scoring è fondato su tre livelli di evidenza:
1. **Patent Google** (massima credibilità): i meccanismi del fan-out, pairwise comparison, entity-level evaluation
2. **Ricerca empirica** (alta credibilità): studi su milioni di citazioni reali (Ahrefs, Growth Memo, SE Ranking, Wellows, Princeton GEO)
3. **Interpretazione progettuale** (approssimazione onesta): i pesi specifici, le soglie, la composizione dello score

### 2.2 I 5 score e i loro pesi

| Score | Nome UI | Peso | Correlazione con citazione AI | Fonte principale |
|---|---|---|---|---|
| Fan-Out Coverage | **Query Reach** | **30%** | r=0.87 (semantic completeness) | Wellows 2026, patent WO2024064249A1 |
| Passage Citability | **Citation Power** | **25%** | r=0.84 (vector alignment) + 44.2% position bias | Wellows 2026, Growth Memo feb 2026 |
| Entity Authority | **Brand Authority** | **20%** | r=0.76 (entity KG density), 4.8x per 15+ entità | Wellows 2026, Digital Applied |
| Extractability | **Extractability** | **15%** | +73% selection boost con structured data | Wellows 2026, Princeton GEO |
| Cross-Platform Signal | **Source Authority** | **10%** | 3-4x per brand su review/community platform | SE Ranking nov 2025, AIVO mar 2026 |
| **Freshness** | *(moltiplicatore)* | *(applicato al composito)* | 3.2x per contenuti < 30 giorni | ConvertMate, Ahrefs 17M study |

**Razionale dei pesi:**

La distribuzione riflette le correlazioni empiriche documentate:
- **Query Reach (30%)**: la semantic completeness è il fattore più fortemente correlato (r=0.87) alla selezione nelle AI Overviews. Con Gemini 3, il fan-out è più aggressivo e pesca da un pool più ampio — la copertura tematica è ancora più critica.
- **Citation Power (25%)**: il vector embedding alignment (r=0.84) e il position bias (44.2% citazioni dal primo 30%) sono segnali fortissimi e direttamente misurabili.
- **Brand Authority (20%)**: promossa da 15% a 20% perché Gemini 3 valuta esplicitamente l'autorità a livello di entità. La correlazione r=0.76 e il moltiplicatore 4.8x per contenuti entity-rich lo giustificano.
- **Extractability (15%)**: il boost del 73% con structured data è significativo, ma è un fattore "abilitante" (se assente, penalizza; se presente, non basta da solo).
- **Source Authority (10%)**: ridotta da 15% a 10% perché il disaccoppiamento ranking/citazione rende la presenza su piattaforme specifiche più strategica che volumetrica — meglio misurata qualitativamente.

**Fonti per i pesi:**
- Wellows, AI Overview ranking factors: https://wellows.com/blog/google-ai-overviews-ranking-factors/
- Growth Memo, citation position analysis: https://www.growth-memo.com/p/the-science-of-how-ai-pays-attention
- AIVO, GEO data marzo 2026: https://www.tryaivo.com/blog/geo-data-nobody-talking-about-march-2026

### 2.3 Il moltiplicatore Freshness

La freshness non è un 6° score perché agisce trasversalmente: un contenuto vecchio è penalizzato indipendentemente dalla sua qualità strutturale.

| Età del contenuto | Moltiplicatore | Fonte |
|---|---|---|
| < 30 giorni | 1.15 | ConvertMate: 3.2x più citazioni per contenuti < 30 giorni |
| 30-60 giorni | 1.00 | Baseline |
| 60-120 giorni | 0.85 | BrightEdge: contenuti aggiornati entro 60 giorni sono 1.9x più citati |
| > 120 giorni | 0.70 | Ahrefs: half-life della visibilità AI compressa a 3-6 mesi |

Il moltiplicatore è derivato dalla `dateModified` nello schema Article (se presente) o dalla data di ultimo fetch in cui il contenuto è risultato modificato. Se nessuna data è disponibile, si usa un moltiplicatore neutro (1.0) con un warning.

**Nota importante**: Qwairy ha trovato che i sistemi AI aggiungono automaticamente l'anno corrente nel 28.1% delle sotto-query fan-out, anche quando l'utente non lo scrive. Questo bias temporale è strutturalmente incorporato nel retrieval. Non è un "nice to have" — è un fattore di retrieval.

**Fonti:**
- Ahrefs, 17M citations freshness: https://ahrefs.com/blog/do-ai-assistants-prefer-to-cite-fresh-content/
- Qwairy, freshness e fan-out: https://www.qwairy.co/blog/content-freshness-ai-citations-guide
- Averi, content refresh flywheel: https://www.averi.ai/how-to/the-content-refresh-flywheel-how-to-3x-your-ai-citations-without-creating-anything-new

---

## 3. Score 1: Query Reach (Fan-Out Coverage) — Peso 30%

### 3.1 Cosa misura

Quanto i contenuti dell'utente coprono il ventaglio di query sintetiche che un motore AI genererebbe tramite fan-out.

### 3.2 Perché è il fattore più importante

Il query fan-out è il meccanismo fondamentale di AI Mode. Elizabeth Reid (Head of Search, Google I/O 2025) ha descritto esplicitamente come AI Mode "breaks the question into different subtopics, and issues a multitude of queries simultaneously on your behalf." Google usa un modello Gemini 2.5 custom specificamente progettato per il fan-out.

I dati empirici di Ekamoira confermano: i siti con copertura tematica > 80% mantengono l'85.4% della visibilità AI nonostante il 73% di instabilità nelle query fan-out. Questo dato è cruciale: le query fan-out cambiano tra una sessione e l'altra, ma la copertura tematica è il segnale stabile.

WordLift ha validato indipendentemente la pipeline URL → Entity Extraction → Query Fan-Out → Embedding Coverage → AI Visibility Score.

### 3.3 Metodo di calcolo

**Input**: query target dell'utente (max 5 nel Free tier), contenuti confermati con passaggi e embedding.

**Step 1 — Generazione fan-out (Gemini 2.5 Flash)**

Per ogni query target, generiamo 10 query sintetiche in 6 categorie:
- `related`: riformulazioni e sinonimi
- `implicit`: bisogni informativi non espressi ma sottintesi
- `comparative`: confronti con alternative
- `exploratory`: approfondimenti su sotto-aspetti
- `decisional`: orientate alla scelta
- `recent`: versioni time-sensitive (con anno corrente)

La scelta di Gemini Flash è tecnica: Google usa Gemini internamente per il fan-out. Usando lo stesso modello, le query sintetiche sono più coerenti con quelle reali.

Con 5 query target × 10 fanout = 50 query sintetiche + 5 query originali = **55 query totali**.

**Step 2 — Embedding (Voyage AI voyage-3-large)**

Query e passaggi vengono embeddati tramite Voyage AI con retrieval asimmetrico (`input_type="query"` vs `input_type="document"`), che migliora la qualità del matching rispetto a embedding simmetrico.

Il calcolo avviene in memoria con NumPy (batch embedding, no roundtrip al DB per ogni confronto).

**Step 3 — Coverage con sistema a fasce**

Per ogni query (target + fanout), si trova il passaggio con la cosine similarity più alta.

| Fascia | Soglia cosine similarity | Significato | Fonte soglia |
|---|---|---|---|
| Copertura eccellente | ≥ 0.88 | Il passaggio risponde direttamente alla query | Wellows: contenuti con cosine > 0.88 hanno 7.3x selection rate |
| Copertura buona | 0.75 – 0.87 | Rilevante e competitivo | Range intermedio standard per embedding RAG |
| Copertura debole | 0.60 – 0.74 | Parzialmente rilevante, non competitivo | Soglia minima di rilevanza semantica |
| Non coperta | < 0.60 | Il contenuto non risponde a questa query | Sotto questa soglia la corrispondenza è ambigua |

**Step 4 — Calcolo score**

```
query_reach = (
    (n_eccellente × 1.0 + n_buona × 0.7 + n_debole × 0.3) / n_totale_query
) × 100
```

Le query nella fascia "debole" contribuiscono al 30% al punteggio (non zero, perché c'è rilevanza parziale, ma sono le quick win più facili — visibili nell'Opportunity Map).

**Fonti:**
- Patent WO2024064249A1: query fan-out
- WordLift, fan-out simulator: https://wordlift.io/blog/en/query-fan-out-ai-search/
- Ekamoira, 80%+ coverage retention: https://www.ekamoira.com/blog/query-fan-out-original-research-on-how-ai-search-multiplies-every-query-and-why-most-brands-are-invisible
- Wellows, cosine 0.88 threshold: https://wellows.com/blog/google-ai-overviews-ranking-factors/
- Surfer SEO, fan-out explainer: https://surferseo.com/blog/query-fan-out/

---

## 4. Score 2: Citation Power (Passage Citability) — Peso 25%

### 4.1 Cosa misura

Quanto ogni passaggio è probabile che venga citato da un motore AI, basato sulle caratteristiche empiriche dei testi effettivamente citati.

### 4.2 Perché questi criteri e non altri

Questa è la sezione che più si discosta dal design originale. I 5 criteri precedenti (self_containedness, claim_clarity, information_density, completeness, verifiability) erano basati sul paper Princeton GEO 2024 e sulla logica del pairwise ranking. Erano proxy ragionevoli di qualità.

I dati empirici di febbraio-marzo 2026 ci dicono cosa **effettivamente** predicono le citazioni. Growth Memo ha analizzato 1.2 milioni di risposte ChatGPT con 18.012 citazioni verificate (P-Value < 0.0001). I risultati cambiano l'approccio:

1. **La posizione nel documento conta più della qualità intrinseca del passaggio**. Il 44.2% delle citazioni viene dal primo 30% del testo. Questo è coerente con il fenomeno "Lost in the Middle" documentato da Liu et al. (Stanford, TACL 2024): i LLM sistematicamente sottopesano le informazioni nel mezzo dei contesti lunghi.

2. **L'entity density è un predittore forte**. I testi citati hanno entity density del 20.6% (nomi propri, brand, strumenti, persone), contro il 5-8% del testo standard.

3. **Il linguaggio definito batte il linguaggio vago**. "Salesforce è il CRM leader per enterprise" viene citato; "potresti considerare un buon CRM" no. I LLM cercano claim verificabili e specifici.

4. **Le statistiche con fonte aumentano la citabilità del 37-41%** (confermato dal paper Princeton e dai dati empirici).

5. **Le heading formulate come domande sono il trigger di citazione**. Il 78.4% delle citazioni con domande viene da heading H2. L'AI tratta l'H2 come prompt e il paragrafo subito dopo come risposta.

### 4.3 I sub-criteri

| Sub-criterio | Peso | Metodo di misura | Fonte |
|---|---|---|---|
| **Position score** | 25% | Dove si trova il passaggio nel documento (primo 30% = 1.0, 30-70% = 0.7, ultimo 30% = 0.55) | Growth Memo, 1.2M risposte ChatGPT |
| **Entity density** | 20% | % di named entities nel passaggio / benchmark 20.6%. NER euristico o modello leggero | Growth Memo, Brown Corpus baseline |
| **Statistical specificity** | 20% | Presenza di dati numerici con contesto/attribuzione. Pattern matching: numeri + parole di contesto (%, milioni, studio, fonte, secondo) | Princeton GEO (KDD 2024): +37-41% |
| **Definiteness** | 15% | Linguaggio assertivo vs vago. Assenza di hedge words (forse, potrebbe, generalmente). Presenza di Definition Lead pattern | Growth Memo: linguaggio definito correlato con citazione |
| **Answer-first structure** | 10% | Le prime 40-60 parole del passaggio contengono una risposta diretta. Pattern: "[Soggetto] è [categoria] che [differenziatore]" | Frase.io, GenOptima: "citation block" format |
| **Source citation** | 10% | Il passaggio contiene riferimenti a fonti esterne inline | Princeton GEO: "Cite Sources" tra le top strategies |

**Calcolo per passaggio:**
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

**Calcolo per contenuto:**
Media ponderata dei citability score dei passaggi, con peso maggiore per i passaggi nel primo 30% del documento.

**Calcolo per progetto (score globale):**
Media dei citability score di tutti i contenuti confermati.

### 4.4 Campionamento dei passaggi

Il sistema precedente scorava solo i 10 passaggi più lunghi. Con il position score, il campionamento cambia:

- **Passaggi nel primo 30%**: scorati tutti (sono i più probabili di essere citati)
- **Passaggi nel 30-70%**: campione dei più lunghi (max 5)
- **Passaggi nell'ultimo 30%**: campione minimo (max 3, il summary/conclusione vale)

I sub-criteri euristici (entity density, statistical specificity, definiteness, answer-first, source citation) vengono calcolati su **tutti** i passaggi senza costi API aggiuntivi. Solo il calcolo LLM-based (se presente in futuro) usa il campionamento.

### 4.5 Nota sui criteri rimossi

I 5 criteri originali (self_containedness, claim_clarity, information_density, completeness, verifiability) non sono "sbagliati" — sono proxy ragionevoli. Tuttavia, nessuno di essi ha una correlazione empirica documentata con le citazioni reali quanto i nuovi criteri. Il self_containedness rimane implicitamente coperto dall'answer-first structure. La verifiability è coperta dalla source citation e statistical specificity. L'information density è catturata dall'entity density (i contenuti entity-rich sono per definizione information-dense).

**Fonti:**
- Growth Memo, citation patterns: https://www.growth-memo.com/p/the-science-of-how-ai-pays-attention
- Liu et al., "Lost in the Middle" (TACL 2024): https://arxiv.org/abs/2307.03172
- Princeton GEO (KDD 2024): https://arxiv.org/abs/2311.09735
- Frase.io, AEO guide: https://www.frase.io/blog/what-is-answer-engine-optimization-the-complete-guide-to-getting-cited-by-ai
- GenOptima, Definition Lead: https://www.gen-optima.com/blog/generative-engine-optimization-best-practices/
- Victorino Group, citation analysis: https://victorinollc.com/thinking/llm-citation-attention-patterns

---

## 5. Score 3: Brand Authority (Entity Authority) — Peso 20%

### 5.1 Cosa misura

Quanto il brand dell'utente è riconosciuto, verificabile e autorevole nell'ecosistema web e nei Knowledge Graph — dal punto di vista dei motori AI.

### 5.2 Perché è stato riprogettato

Il vecchio "Entity Coherence" misurava coerenza terminologica e co-occorrenza. Misurava se il brand "parla di sé in modo coerente" — un segnale reale ma incompleto.

Gemini 3 valuta l'autorità a livello di **entità**, non di dominio. I dati di Wellows mostrano una correlazione di r=0.76 tra entity Knowledge Graph density e citazione AI — il secondo fattore più forte. Contenuti con 15+ entità connesse hanno 4.8x probabilità di selezione.

Inoltre, dati SE Ranking (novembre 2025) e AIVO (marzo 2026) mostrano che:
- Brand con profili su review platform (G2, Trustpilot, Capterra): **3x** citazioni ChatGPT
- Brand con presenza su Reddit e Quora: **4x** citazioni
- Questi sono segnali di corroborazione esterna che il vecchio score non misurava

### 5.3 I sub-criteri

| Sub-criterio | Peso | Metodo di misura | Fonte |
|---|---|---|---|
| **Knowledge Graph presence** | 30% | Verifica esistenza: entità Wikidata, Knowledge Panel Google, pagina Wikipedia. Brave Search per "site:wikidata.org [brand]", "site:wikipedia.org [brand]" | ChatGPT cita Wikipedia nel 47.9% dei casi; Wikidata è base del KG Google |
| **Cross-web corroboration** | 25% | Rapporto contenuti "mention" (terzi che parlano del brand) / contenuti "own" dalla discovery. Brand con alto rapporto mention/own hanno più corroborazione esterna | SE Ranking: 3-4x citazioni per brand con presenza su review/community |
| **Entity density nei contenuti** | 20% | Media di entità riconosciute per passaggio (NER) sui contenuti del brand. Benchmark: 20.6% per testi citati | Growth Memo, feb 2026 |
| **Terminological consistency** | 15% | Quanti termini significativi (≥4 caratteri) appaiono in almeno 2 pagine diverse? Coerenza lessicale cross-pagina | WordLift: entity integrity come criterio pratico |
| **Entity Home strength** | 10% | Qualità della pagina About + schema Organization con sameAs links a Wikipedia, Wikidata, LinkedIn, Crunchbase. Presenza di author entities con credenziali | Google 2026: Entity Home come punto di riferimento per risolvere conflitti |

**Calcolo:**
```
brand_authority = (
    kg_presence × 0.30 +
    cross_web_corroboration × 0.25 +
    entity_density_avg × 0.20 +
    term_consistency × 0.15 +
    entity_home_strength × 0.10
) × 100
```

### 5.4 Entity Authority Builder (dentro Overview)

Oltre allo score, Visiblee mostra una checklist di azioni per migliorare l'entity authority:

1. **Wikidata**: "Crea un'entità Wikidata per [Brand]" — verifica automatica se esiste, guida passo-passo se no
2. **Schema Organization**: "Aggiungi schema Organization con sameAs links" — genera il JSON-LD
3. **Review platform**: "Apri un profilo su G2/Trustpilot" — verifica se esiste
4. **Community**: "Rispondi a thread rilevanti su Reddit/Quora questa settimana"
5. **About page**: "Migliora la tua About page con: storia, credenziali, team, contatti"

**Fonti:**
- Wellows, entity KG density r=0.76: https://wellows.com/blog/google-ai-overviews-ranking-factors/
- LinkSurge, entity authority: https://linksurge.jp/blog/en/entity-authority-ai-search-2026/
- ClickRank, Knowledge Graph SEO: https://www.clickrank.ai/knowledge-graph-seo-guide/
- AIVO, third-party credibility 3-4x: https://www.tryaivo.com/blog/geo-data-nobody-talking-about-march-2026
- Google, Knowledge Panel changes 2026: concetto di Entity Home
- 12AM Agency, entity SEO: https://12amagency.com/blog/entity-seo-optimization-the-definitive-2026-guide/
- ALM Corp, semantic entity optimization: https://almcorp.com/blog/ai-seo-semantic-entity-optimization-guide/

---

## 6. Score 4: Extractability (Chunkability + Technical) — Peso 15%

### 6.1 Cosa misura

Quanto il contenuto è strutturato per essere facilmente scomposto, estratto e processato dai motori AI, sia a livello di contenuto che di markup tecnico.

### 6.2 Perché include il technical check

Nella versione precedente, il technical check (schema markup, robots.txt) era assente. I dati 2026 lo rendono imprescindibile:

- Schema markup: **+73% selection rate** (Wellows)
- Author schema: **3x** più probabilità di citazione (BrightEdge)
- FAQ schema: **+44%** citazioni AI (BrightEdge)
- Contenuti con heading H2→H3 + bullet point: **+40%** citation rate vs prose non strutturata (Quolity AI)
- Contenuti strutturati con elenchi: **3x** più probabili di essere citati (Snezzi)

Inoltre, con l'80% dei publisher che bloccano almeno un AI crawler, i brand che rendono i propri contenuti **accessibili** ai bot AI hanno un vantaggio strutturale.

### 6.3 I sub-criteri

| Sub-criterio | Peso | Metodo di misura | Fonte |
|---|---|---|---|
| **Passage length** | 20% | % passaggi nella finestra ottimale 134-167 parole. Range accettabile: 100-250. Penalizza < 50 e > 300 | Wellows: finestra ottimale per AI Overview extraction |
| **Answer capsule presence** | 20% | Ogni sezione (dopo H2) ha un blocco di 40-60 parole che risponde direttamente? Pattern Definition Lead | Averi, GenOptima: "citation-ready block" |
| **Heading structure** | 15% | Heading H2 presenti, formulati come domande. 78.4% delle citazioni con domande viene da heading | Growth Memo |
| **Schema markup** | 20% | Presenza di: Article con author e dateModified, Organization con sameAs, FAQ (se contenuto ha Q&A) | Wellows: +73% selection boost |
| **Self-reference pollution** | 10% | Frequenza di riferimenti relativi ("come detto sopra", "questo", "ciò") che rompono l'autocontenimento dei passaggi | Ricerca RAG: i passaggi devono funzionare in isolamento |
| **AI crawler access** | 15% | robots.txt non blocca GPTBot, ClaudeBot, PerplexityBot, Google-Extended. HTML5 semantico (article, section vs div soup) | Press Gazette: 80% publisher bloccano almeno un crawler |

**Calcolo:** Il calcolo è interamente **euristico**, senza LLM. Ogni sub-criterio produce un valore 0-1, combinati con i pesi sopra e normalizzati a 100.

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

### 6.4 Nota architetturale

Per il schema check e il crawler access check, il content fetcher deve preservare:
- L'HTML originale (non solo il testo estratto) — per parsing JSON-LD e analisi struttura DOM
- Il robots.txt del dominio — fetchato una volta per progetto

**Fonti:**
- Wellows, 134-167 parole e +73% schema: https://wellows.com/blog/google-ai-overviews-ranking-factors/
- Growth Memo, heading = prompt: https://www.growth-memo.com/p/the-science-of-how-ai-pays-attention
- Quolity AI, structure boost: https://quolity.ai/ai-citations-optimization/
- Snezzi, structure 3x: https://snezzi.com/blog/getting-citations-right-in-ai-generated-answers-best-practices-for-2025/
- GenOptima, Definition Lead: https://www.gen-optima.com/blog/generative-engine-optimization-best-practices/
- Averi, citation block: https://www.averi.ai/blog/google-ai-overviews-optimization-how-to-get-featured-in-2026

---

## 7. Score 5: Source Authority (Cross-Platform Signal) — Peso 10%

### 7.1 Cosa misura

La distribuzione della presenza del brand su canali diversi dal sito principale, pesata per la piattaforma AI target dell'utente.

### 7.2 Perché il peso è sceso a 10%

Il disaccoppiamento ranking/citazione rende la "presenza" meno importante della "qualità della presenza". Essere su 6 piattaforme con contenuti superficiali vale meno che essere su 2 piattaforme con contenuti profondi e entity-rich. Il peso è sceso per riflettere questo: la cross-platform signal è un segnale di contorno, non un driver primario.

### 7.3 Metodo di calcolo

Le piattaforme monitorate e i loro pesi variano in base alla piattaforma AI target dell'utente (derivata dal wizard post-analisi o dalla Settings del progetto):

| Piattaforma | Peso base | Boost per Google AI | Boost per ChatGPT | Boost per Perplexity |
|---|---|---|---|---|
| Website (proprio) | 1.0 | — | — | — |
| YouTube | 0.7 | +0.3 (= 1.0) | — | — |
| LinkedIn | 0.7 | — | — | — |
| Medium/Substack | 0.6 | — | — | — |
| Wikipedia | 0.5 | — | +0.5 (= 1.0) | — |
| Reddit | 0.4 | — | — | +0.5 (= 0.9) |
| News/media | 0.8 | — | +0.2 (= 1.0) | — |
| Review platform (G2, Trustpilot) | 0.6 | — | +0.3 (= 0.9) | — |

Per ogni piattaforma:
```
platform_score = presence × freshness × quality
```
Dove:
- `presence` = min(n_contenuti / 5, 1.0)
- `freshness` = max(0, 1 - (days_since_newest / 365))
- `quality` = proxy basato su word count medio e entity density

```
source_authority = (Σ platform_score_i × weight_i) / (Σ weight_i) × 100
```

**Fonti:**
- Position Digital, piattaforme più citate per motore: https://www.position.digital/blog/ai-seo-statistics/
- Ahrefs, YouTube most-cited in AIO: https://ahrefs.com/blog/ai-overview-citations-top-10/
- Frase.io, piattaforma-specific preferences: https://www.frase.io/blog/what-is-generative-engine-optimization-geo

---

## 8. Il composite score: AI Readiness Score

### 8.1 Formula

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

Il `freshness_multiplier` a livello di progetto è la media dei moltiplicatori di freshness dei singoli contenuti, pesata per l'importanza del contenuto (contenuti che coprono più query fan-out pesano di più).

### 8.2 Interpretazione

| Range | Livello | Significato |
|---|---|---|
| 0-25 | Basso | Il brand è quasi invisibile per i motori AI |
| 26-50 | Sotto la media | Presenza parziale, molti gap critici |
| 51-70 | Nella media | Competitivo su alcune query, migliorabile |
| 71-85 | Sopra la media | Buona visibilità, ottimizzazione fine |
| 86-100 | Eccellente | Tra i più citabili nel proprio settore |

### 8.3 Limiti e onestà metodologica

- Lo score **non** è "il punteggio interno di Google". È la migliore approssimazione dall'esterno basata sui segnali documentati.
- Le citazioni AI sono **probabilistiche**, non deterministiche. SparkToro (gennaio 2026) ha trovato che c'è < 1% di probabilità che ChatGPT dia la stessa lista di brand in due risposte consecutive. Solo il 30% dei brand mantiene visibilità costante tra risposte AI consecutive.
- I pesi sono **calibrabili**: sono costanti nel codice ma progettati per essere aggiornati tramite backtesting su dati reali dalla citation verification.
- Lo score misura la **citabilità potenziale**, non la citazione effettiva. La citation verification (Sezione 9) fornisce il feedback loop con la realtà.

---

## 9. Citation Verification via Gemini API con Grounding

### 9.1 Scopo

Verificare se, per le query target dell'utente, i motori AI citano il brand nelle loro risposte. Questo è il feedback loop che chiude il ciclo: lo scoring misura il potenziale, la citation verification misura la realtà.

### 9.2 Meccanismo

Utilizziamo la **Gemini API con Grounding by Google Search**. Quando il grounding è attivato, Gemini esegue ricerche web reali e restituisce `groundingMetadata` con:
- `webSearchQueries`: le query di ricerca eseguite (utile per capire il fan-out reale)
- `groundingChunks`: le fonti web usate (URI e titolo)
- `groundingSupports`: il mapping tra segmenti della risposta e fonti specifiche

Questa API è **ufficiale**, legale, e restituisce dati strutturati. Non è scraping.

### 9.3 Pipeline settimanale

Per ogni query target (max 5 nel Free tier):

1. Invia la query a Gemini con grounding attivato
2. Raccogli le fonti citate (`groundingChunks`)
3. Per ogni fonte, verifica: è un contenuto dell'utente? È un competitor noto? È un nuovo dominio?
4. Salva i risultati nel database con timestamp
5. Confronta con il ciclo precedente: l'utente è apparso/scomparso? Nuovi competitor?

### 9.4 Output

**In Queries (sommario neutro):**
Per ogni query target, mostra:
- "Fonti citate da Google: [dominio1.com], [dominio2.com], [dominio3.com]"
- Badge: "Citato ✓" o "Non citato ✗"
- Trend: "Citato 2/4 settimane" (storico)

**In Competitors (dettaglio actionable):**
Per ogni competitor citato al posto dell'utente:
- Fetch della pagina citata
- Analisi strutturale: entity density, passage length, schema, freshness, heading structure
- Gap report: "Il competitor è citato perché: [lista differenze specifiche vs il tuo contenuto]"
- Azione suggerita: "Per competere con questa fonte, il tuo contenuto [X] dovrebbe: [azione1], [azione2]"

### 9.5 Limitazioni

- La Gemini API simula Gemini, non è identica al 100% a ciò che AI Overview mostra nella SERP. Le fonti possono differire leggermente.
- Il costo è contenuto (~$0.01-0.03 per query), ma con 5 query settimanali per progetto è sostenibile.
- Non copre ChatGPT o Perplexity — solo l'ecosistema Google. Per le altre piattaforme, il Share of Model Tracking (futuro) richiederà un approccio diverso.

### 9.6 Uso per il calibramento degli score

I dati della citation verification alimentano un loop di calibramento:
- Se un contenuto con score alto non viene mai citato, i pesi dei sub-criteri vanno rivisti
- Se un contenuto con score basso viene citato, c'è un segnale non catturato
- Nel tempo, il sistema impara quali sub-criteri predicono effettivamente le citazioni per il settore dell'utente

**Fonte:**
- Google, Gemini API Grounding documentation: https://ai.google.dev/gemini-api/docs/google-search

---

## 10. Competitor Citation Analysis

### 10.1 Scopo

Capire **perché** un competitor viene citato e l'utente no. Non solo chi compete, ma cosa hanno di diverso a livello di contenuto e struttura.

### 10.2 Pipeline automatica settimanale

1. Dalla citation verification (Sezione 9), raccogliamo le fonti citate per ogni query target
2. Per ogni fonte non-utente (competitor), facciamo fetch della pagina
3. Analizziamo con lo stesso pipeline dell'utente:
   - Entity density per passaggio
   - Position delle informazioni chiave (primo 30% vs resto)
   - Schema markup presente
   - Freshness (dateModified)
   - Heading structure (H2 come domande?)
   - Statistical specificity (quante statistiche con fonte?)
   - Answer capsule presence (40-60 parole dopo H2?)
4. Generiamo un "Gap Report" automatico per ogni query: confronto strutturato tra il contenuto dell'utente più vicino e il contenuto del competitor citato

### 10.3 Output in Competitors

Per ogni competitor citato:

```
COMPETITOR: example-competitor.com
Citato per: "migliore CRM per startup"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PERCHÉ È CITATO (analisi strutturale):
• Answer capsule: Sì (47 parole, subito dopo H2)    TU: No
• Statistiche: 3 con fonte inline                   TU: 0
• Entity density: 22.4%                             TU: 8.1%
• Schema Article: Sì, con author                    TU: No
• Aggiornato: 8 giorni fa                           TU: 94 giorni fa
• Heading H2 come domanda: Sì                       TU: No

AZIONI SUGGERITE (ordinate per impatto):
1. Aggiungi un answer capsule di 40-60 parole dopo l'H2 principale
2. Inserisci almeno 2 statistiche con fonte (es: "secondo [fonte], il 73% di...")
3. Aggiungi schema Article con author e dateModified
4. Aggiorna il contenuto (94 giorni fa è oltre la soglia critica di 60 giorni)
```

Questo "reverse engineering" è la vera UVP di Visiblee: non dice solo "il tuo score è 42" — dice "ecco cosa ha il competitor che a te manca, e come replicarlo."

---

## 11. Glossario dei parametri configurabili

| Parametro | Default | Effetto | Fonte della calibrazione |
|---|---|---|---|
| `COVERAGE_THRESHOLD_EXCELLENT` | `0.88` | Soglia per copertura eccellente | Wellows: 7.3x selection rate |
| `COVERAGE_THRESHOLD_GOOD` | `0.75` | Soglia per copertura buona | Standard RAG retrieval |
| `COVERAGE_THRESHOLD_WEAK` | `0.60` | Soglia per copertura debole | Soglia minima rilevanza |
| `FANOUT_PER_QUERY` | `10` | Query sintetiche per target query | Bilanciamento coverage/costo |
| `MAX_QUERIES_FREE` | `5` | Query target per progetto Free | Cap commerciale |
| `MAX_CONTENTS_FREE` | `20` | Contenuti monitorati per progetto Free | Cap commerciale |
| `FRESHNESS_BOOST_30D` | `1.15` | Moltiplicatore freshness < 30 giorni | ConvertMate: 3.2x citazioni |
| `FRESHNESS_NEUTRAL` | `1.00` | Moltiplicatore freshness 30-60 giorni | Baseline |
| `FRESHNESS_DECAY_120D` | `0.85` | Moltiplicatore freshness 60-120 giorni | BrightEdge: 1.9x per < 60gg |
| `FRESHNESS_PENALTY` | `0.70` | Moltiplicatore freshness > 120 giorni | Ahrefs: half-life 3-6 mesi |
| `ENTITY_DENSITY_BENCHMARK` | `0.206` | Entity density di riferimento (20.6%) | Growth Memo, Brown Corpus |
| `PASSAGE_LENGTH_OPTIMAL_MIN` | `134` | Min parole passaggio ottimale | Wellows |
| `PASSAGE_LENGTH_OPTIMAL_MAX` | `167` | Max parole passaggio ottimale | Wellows |
| `ANSWER_CAPSULE_MIN_WORDS` | `40` | Min parole answer capsule | Averi, GenOptima |
| `ANSWER_CAPSULE_MAX_WORDS` | `60` | Max parole answer capsule | Averi, GenOptima |
| `WORKER_POLL_INTERVAL` | `5` | Secondi tra polling worker | Performance |
| `MAX_PAGES_TO_FETCH` | `8` | Pagine fetchate nella preview | Performance |

---

## 12. Cosa non facciamo (e perché)

**Non facciamo scraping dei motori AI.** Usiamo la Gemini API con Grounding, che è ufficiale. Non facciamo scraping di ChatGPT, Perplexity o Google Search — viola i ToS e non è sostenibile.

**Non promettiamo un ranking specifico.** Le citazioni AI sono probabilistiche (< 1% di ottenere la stessa lista di brand in due risposte consecutive). Visiblee misura la citabilità e il trend, non promette una "posizione".

**Non usiamo BM25 o full-text search.** Il retrieval è esclusivamente vettoriale. Per il matching semantico tra query ipotetiche e passaggi, la cosine similarity su embeddings di alta qualità (Voyage AI con retrieval asimmetrico) supera i metodi lessicali.

**Non stimiamo la probabilità di citazione con un LLM.** Sarebbe computazionalmente proibitivo e soggetto ad allucinazioni. Usiamo segnali empiricamente correlati con le citazioni reali.

**Non facciamo re-ranking pairwise dei passaggi dell'utente vs competitor.** Il patent lo descrive, ma replicarlo richiede l'accesso al full custom corpus di Google — che non abbiamo. Il competitor citation analysis è la migliore approssimazione praticabile.
