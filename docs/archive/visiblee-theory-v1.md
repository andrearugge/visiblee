# Visiblee — Documento Teorico

## Come funziona Google AI Mode e perché serve un nuovo approccio alla visibilità

---

## 1. Introduzione

Il modo in cui i motori di ricerca presentano le informazioni è cambiato radicalmente. Google AI Mode, AI Overviews e le risposte conversazionali di LLM (ChatGPT, Perplexity, Gemini) stanno sostituendo i classici "10 link blu" con risposte sintetiche generate dall'AI.

L'analisi dei patent di Google e della ricerca accademica e di settore rivela che AI Mode opera attraverso meccanismi fondamentalmente diversi dalla SEO tradizionale. Questo documento descrive questi meccanismi, le fonti che li documentano, e come Visiblee li traduce in metriche e azioni concrete per i propri utenti.

---

## 2. I 6 meccanismi fondamentali di Google AI Mode

AI Overviews e AI Mode sono governati dagli stessi meccanismi. Quello che segue è un'analisi basata sui patent pubblici di Google e sull'analisi di settore condotta da iPullRank (Michael King), WordLift (Andrea Volpini), e sulla ricerca accademica (paper GEO, KDD 2024).

### 2.1 Stateful Chat — La memoria della conversazione
**Patent**: US20240289407A1 — "Search with stateful chat"

AI Mode non tratta ogni query in modo isolato. Mantiene un contesto persistente dell'utente, tracciando le query precedenti, la posizione, il dispositivo e i segnali comportamentali, e trasforma ogni interazione in un embedding vettoriale.

Il patent descrive come le "informazioni contestuali associate all'utente o al dispositivo client" includano "una o più query precedenti emesse dall'utente durante la sessione di ricerca" e "coordinate di posizione dell'utente". Le risposte generate dal sistema vengono incluse nel contesto per i turni di conversazione successivi.

**Implicazione per Visiblee**: il rank tracking tradizionale (una query = un risultato) è meno significativo. La stessa query genera risposte diverse per persone diverse e in momenti diversi. Visiblee deve misurare la "citabilità" intrinseca del contenuto, non una posizione statica.

### 2.2 Query Fan-Out — La moltiplicazione delle domande
**Patent**: WO2024064249A1 — "Systems and methods for prompt-based query generation for diverse retrieval"

Quando un utente inserisce una query, il sistema non cerca solo quella query. Utilizza un LLM per generare decine di query sintetiche correlate, implicite, comparative e recenti. Il processo è descritto come "prompted expansion": un modello AI riceve istruzioni strutturate per creare query che enfatizzano diversi tipi di intento.

Le categorie di query sintetiche includono:
- **Query correlate**: sinonimi, riformulazioni, variazioni terminologiche
- **Query implicite**: bisogni informativi non espressi ma sottintesi nella query originale
- **Query comparative**: confronti con alternative ("A vs B")
- **Query esplorative**: approfondimenti su sotto-aspetti ("come funziona X")
- **Query decisionali**: orientate alla scelta ("migliore X per Y situazione")
- **Query recenti**: versioni time-sensitive della query

Per query complesse o multi-intento, Gemini può moltiplicare il fan-out, innescando una seconda o terza ondata di sotto-query per colmare lacune nel contesto. Google AI Mode genera tipicamente 8-12 sotto-query per query standard, e può arrivare a centinaia per le query Deep Search.

Il fan-out opera su superfici di retrieval multiple simultaneamente: web live, Knowledge Graph di Google, dati strutturati, risultati shopping e database specializzati.

**Implicazione per Visiblee**: non basta ottimizzare per una keyword. I contenuti devono coprire l'intero "ventaglio" di query sintetiche. Visiblee deve simulare il fan-out e misurare la copertura. → Score: **Fan-Out Coverage** (UI: *Query Reach*)

### 2.3 Custom Corpus — Il mini-indice personalizzato
**Patent**: US11769017B1 — "Generative summaries for search results"

Dopo il fan-out, ogni sotto-query recupera documenti dall'indice. Il sistema crea embedding vettoriali di ogni query, passaggio e documento, e misura quanto questi embedding si allineano con l'intento combinato della query dell'utente e delle sue variazioni espanse.

I passaggi con i punteggi di similarità più alti restano nell'indice; le corrispondenze più deboli vengono filtrate. Il risultato è un "custom corpus": un dataset concentrato con poche decine di passaggi tratti dalle fonti semanticamente più allineate. Questo corpus è la base per tutto il ragionamento successivo.

**Implicazione per Visiblee**: per entrare nel custom corpus, i contenuti dell'utente devono avere embedding che si allineano bene con le query sintetiche del fan-out. Visiblee usa la cosine similarity tra embedding delle query e dei passaggi per misurare questa probabilità.

### 2.4 Pairwise Ranking — Il confronto testa-a-testa
**Patent**: US20250124067A1 — "Method for Text Ranking with Pairwise Ranking Prompting"

Una volta assemblato il custom corpus, il sistema non assegna punteggi statici. Invece, un LLM confronta i passaggi a coppie: riceve la query dell'utente, due passaggi candidati, e ragiona su quale sia più rilevante. Questo processo viene ripetuto su molte coppie per costruire una lista ordinata.

Questa tecnica bypassa i modelli di scoring tradizionali come BM25 o la semplice similarità vettoriale. Il sistema chiede: "Data questa query, quale di questi due passaggi è migliore?" e lascia che il modello ragioni la risposta.

**Implicazione per Visiblee**: il contenuto non viene valutato in isolamento — viene messo in competizione diretta con un altro passaggio. Ogni singolo paragrafo conta, non l'articolo nel suo complesso. Visiblee deve valutare la qualità a livello di passaggio, non di pagina. → Score: **Passage-Level Quality** (UI: *Answer Strength*)

### 2.5 User Embeddings — La personalizzazione profonda
**Patent**: WO2025102041A1 — "User Embedding Models for Personalization of Sequence Processing Models"

Il sistema costruisce un profilo vettoriale persistente per ciascun utente basato sulla storia di interazioni, preferenze e comportamenti. Questo profilo condiziona il modo in cui le query vengono interpretate e le risposte generate.

Il patent descrive un "User Embedding Module" (UEM) che processa la storia dell'utente in formato testuale libero e la comprime in embedding. Ogni elemento della storia include embedding compositi di titolo/genere, rating e descrizione. Questi embedding vengono poi usati come "soft prompt" personalizzato che condiziona la risposta del modello.

La stessa query emessa da due utenti diversi può risultare in set di retrieval completamente differenti. Il ranking non è più globale — è contestuale.

**Implicazione per Visiblee**: non esiste più "la posizione 1" universale. Visiblee non può e non deve promettere un ranking specifico. Invece, misura la qualità intrinseca del contenuto e la sua probabilità di essere selezionato attraverso diversi profili utente.

### 2.6 Reasoning Steps — Come il modello ragiona
**Patent**: US20240256965A1 — "Instruction Fine-Tuning Machine-Learned Models Using Intermediate Reasoning Steps"

Questo patent descrive il meccanismo con cui gli LLM di Google vengono addestrati a ragionare per passi intermedi (chain-of-thought). Il sistema non produce direttamente una risposta — genera una catena di ragionamento interna che guida la selezione e la sintesi delle informazioni.

Il contenuto viene selezionato non solo per la sua rilevanza diretta, ma per come supporta la catena di ragionamento. Un passaggio può essere scelto non perché copre l'intera domanda, ma perché fornisce la migliore spiegazione per un singolo passo nella catena di ragionamento.

**Implicazione per Visiblee**: i contenuti devono essere strutturati in modo che ogni passaggio contribuisca chiaramente a una logica argomentativa. Passaggi vaghi, generici o non verificabili vengono scartati nel processo di reasoning. → Score: **Chunkability** (UI: *Extractability*)

---

## 3. Il flusso completo di AI Mode

Riepilogo del processo end-to-end:

1. **Arrivo della query** → il sistema recupera il profilo utente (user embedding) per personalizzare tutto
2. **Query fan-out** → genera decine di sotto-query correlate, implicite, comparative
3. **Retrieval** → per ogni sotto-query, recupera documenti dall'indice e li segmenta in passaggi
4. **Custom corpus** → filtra i passaggi migliori via embedding similarity, creando un mini-database dedicato
5. **Pairwise ranking** → confronta i passaggi a coppie, un LLM decide quale vince in ogni confronto
6. **Reasoning & synthesis** → il modello ragiona attraverso i passaggi sopravvissuti, sceglie quali citare, e genera la risposta finale

---

## 4. Framework di scoring di Visiblee

### 4.1 Principio fondamentale

Non esistono formule "ufficiali" nei patent di Google che si possano replicare per ottenere un punteggio "vero". I patent descrivono meccanismi (come funziona il sistema), non rubric di scoring (come valutare i contenuti dall'esterno).

Lo scoring di Visiblee è costruito su tre livelli di fondamento:
- **Fondato sui patent** (massima credibilità): i meccanismi del fan-out, pairwise comparison, valutazione a livello di passaggio, personalizzazione tramite user embedding
- **Fondato sulla ricerca di settore** (buona credibilità): la pipeline di WordLift per il fan-out coverage via embedding similarity, le metriche GEO del paper KDD 2024, i dati empirici su lunghezza ottimale dei passaggi
- **Interpretazione progettuale** (approssimazione onesta): i pesi specifici, le soglie, la composizione del meta-score

### 4.2 I 5 sotto-score

#### 4.2.1 Fan-Out Coverage — UI: "Query Reach" (peso: 30%)
**Cosa misura**: quanto i contenuti dell'utente coprono il ventaglio di query sintetiche che AI Mode genererebbe.

**Metodo di calcolo**:
1. Per ogni query target dell'utente, un LLM genera 15-30 query sintetiche di fan-out (correlate, implicite, comparative, recenti) usando chain-of-thought
2. Per ogni query sintetica, si calcola la cosine similarity tra l'embedding della query e gli embedding dei passaggi del contenuto dell'utente
3. Un passaggio "copre" una query sintetica se la similarity supera una soglia calibrata (inizialmente 0.75, da raffinare)
4. Fan-Out Coverage = (query sintetiche coperte / query sintetiche totali) × 100

**Formula**:
```
similarity(q, p) = cosine(embed(q), embed(p))
covered(q) = 1 se max(similarity(q, p) per ogni passaggio p) > threshold
FanOutScore = (Σ covered(q_i) / N) × 100
```

**Fondamento**: pipeline WordLift (URL → Entity Extraction → Query Fan-Out → Embedding Coverage → AI Visibility Score), patent WO2024064249A1.

#### 4.2.2 Passage-Level Quality — UI: "Answer Strength" (peso: 30%)
**Cosa misura**: quanto ogni passaggio è forte in un potenziale confronto pairwise.

**Metodo di calcolo**:
1. Il contenuto viene segmentato in passaggi (paragrafi o sezioni logiche)
2. Per ogni passaggio, un LLM valuta 5 criteri (0-10 ciascuno):
   - **Self-containedness** (UI: *Standalone Clarity*): il passaggio ha senso letto in isolamento?
   - **Claim clarity** (UI: *Claim Precision*): contiene affermazioni chiare, specifiche, verificabili?
   - **Information density** (UI: *Information Density*): rapporto tra informazione utile e "filler"?
   - **Completeness** (UI: *Answer Completeness*): risponde a una domanda specifica in modo esauriente?
   - **Verifiability** (UI: *Verifiability*): le affermazioni sono supportate da dati, fonti, numeri?
3. Passage Quality Score = media ponderata dei 5 criteri, normalizzata a 100
4. Lo score del contenuto è la media degli score dei suoi passaggi (con possibilità di evidenziare il passaggio più debole)

**Opzione avanzata**: pairwise comparison reale con i passaggi dei competitor che appaiono nelle AI Overview per la stessa query.

**Fondamento**: patent US20250124067A1 (pairwise ranking prompting), paper GEO KDD 2024 (Subjective Impression con 7 aspetti valutati da LLM).

#### 4.2.3 Chunkability — UI: "Extractability" (peso: 15%)
**Cosa misura**: quanto il contenuto è strutturato per essere facilmente scomposto ed estratto dagli LLM.

**Metodo di calcolo** (euristico, automatizzabile senza LLM):
1. **Paragraph length**: penalizza passaggi sotto 50 parole o sopra 300 parole (ottimale: 134-167 parole secondo la ricerca Wellows)
2. **Heading coverage**: percentuale di sezioni con heading chiaro
3. **Self-reference pollution**: frequenza di riferimenti relativi ("come detto sopra", "questo", "ciò") che rompono l'autocontenimento
4. **Schema/markup**: presenza di dati strutturati, tabelle, liste
5. **Answer-first structure**: le risposte/definizioni appaiono all'inizio delle sezioni?

**Fondamento**: ricerca Wellows (lunghezza ottimale 134-167 parole), dati Mike King (chunking migliora rilevanza semantica del 9-15%), paper GEO.

#### 4.2.4 Entity Coherence — UI: "Brand Trust" (peso: 15%)
**Cosa misura**: il brand è riconoscibile come entità coerente attraverso contenuti e piattaforme.

**Metodo di calcolo**:
1. Estrazione entità da tutti i contenuti (nome brand, persone, prodotti, topic)
2. **Term consistency**: lo stesso concetto è nominato nello stesso modo ovunque?
3. **Semantic cohesion**: quanto sono vicini tra loro gli embedding dei diversi contenuti nello spazio vettoriale?
4. **Co-occurrence**: le entità chiave appaiono insieme in modo consistente?
5. **Cross-platform presence**: la stessa identità è riconoscibile su piattaforme diverse?

**Fondamento**: WordLift (Entity Integrity come criterio pratico), patent WO2025102041A1 (user embedding condizionato da entità).

#### 4.2.5 Cross-Platform Signal Strength — UI: "Source Authority" (peso: 10%)
**Cosa misura**: la distribuzione della presenza su canali diversi che rafforzano la probabilità di retrieval.

**Metodo di calcolo**:
1. Mappa presenza su N canali (sito web, LinkedIn, Medium, Substack, Reddit, testate, YouTube)
2. Per ogni canale: contenuti presenti, freschezza, rilevanza
3. Pesi differenziati per canale (testata autorevole > post Reddit)

**Fondamento**: patent confermano che il fan-out opera su superfici di retrieval multiple; First Page Sage ha documentato come i diversi LLM pesano le fonti.

### 4.3 AI Readiness Score (meta-score)

```
AI_Readiness = 0.30 × FanOutCoverage + 0.30 × PassageQuality + 
               0.15 × Chunkability + 0.15 × EntityCoherence + 
               0.10 × CrossPlatformSignal
```

I pesi sono calibrabili nel tempo. La distribuzione iniziale riflette l'importanza relativa dei meccanismi nei patent: fan-out e pairwise ranking sono i più determinanti, seguiti da struttura e coerenza.

### 4.4 Trasparenza metodologica

Visiblee è trasparente sulla propria metodologia. Lo score non è "il punteggio interno di Google" — è la migliore approssimazione possibile dall'esterno, basata sui meccanismi documentati nei patent. Le azioni correttive che ne derivano sono le stesse indipendentemente dal punteggio esatto.

I pannelli "Come funziona?" nell'interfaccia permettono all'utente di capire cosa misura ogni score e perché, rendendo il prodotto accessibile anche a chi non conosce i meccanismi tecnici dell'AI search.

---

## 5. Letteratura e fonti di riferimento

### 5.1 Patent Google
| Patent | Titolo | Meccanismo |
|--------|--------|------------|
| US20240289407A1 | Search with stateful chat | Architettura AI Mode |
| WO2024064249A1 | Prompt-based query generation for diverse retrieval | Query Fan-Out |
| US11769017B1 | Generative summaries for search results | Custom Corpus / AI Overview |
| US20250124067A1 | Method for text ranking with pairwise ranking prompting | Pairwise Ranking |
| WO2025102041A1 | User embedding models for personalization | User Embeddings |
| US20240256965A1 | Instruction fine-tuning with intermediate reasoning steps | Reasoning Chains |

### 5.2 Ricerca accademica
- **Aggarwal et al. (2024)**: "GEO: Generative Engine Optimization" — KDD 2024. Definisce le metriche Position-Adjusted Word Count e Subjective Impression. Dimostra che strategie come Statistics Addition e Quotation Addition migliorano la visibilità del 30-40%.
- **G-Eval (Liu et al., 2023)**: Metodologia per la valutazione di testi tramite LLM con chain-of-thought, usata come base per la Subjective Impression nel paper GEO.

### 5.3 Ricerca di settore
- **iPullRank / Michael King (2025)**: "How AI Mode Works" — analisi tecnica completa dei patent con implicazioni per la SEO
- **WordLift / Andrea Volpini (2025)**: Pipeline di Fan-Out Simulation (URL → Entity Extraction → Query Fan-Out → Embedding Coverage → AI Visibility Score)
- **Ekamoira Research (2025)**: Fan-Out Multiplier Effect (FME), Cross-Platform Fan-Out Index (CPFI), dati empirici su copertura tematica e visibilità AI
- **Wellows (2025)**: Lunghezza ottimale dei passaggi per estrazione AI Overview (134-167 parole)
- **First Page Sage (2025)**: Studio su 11.128 query commerciali per identificare i fattori di ranking dei generative AI chatbot
- **WordLift (2026)**: "Why AI Cites Some Pages and Ignores Others" — analisi degli embedding come meccanismo di retrieval, criteri di Information Gain, Task Completion, Verifiability, Entity Integrity

### 5.4 Concetti chiave
- **Generative Engine Optimization (GEO)**: ottimizzazione per motori di ricerca generativi
- **Query Fan-Out**: espansione della query in un ventaglio di query sintetiche
- **Passage-Level Retrieval**: valutazione a livello di passaggio, non di pagina
- **Dense Retrieval**: recupero basato su similarità vettoriale
- **Custom Corpus**: mini-indice personalizzato costruito per ogni singola query
- **Pairwise Ranking**: confronto testa-a-testa tra passaggi tramite LLM reasoning
- **E-E-A-T**: Experience, Expertise, Authoritativeness, Trustworthiness

---

## 6. Perché Visiblee è diverso dai competitor

### 6.1 Competitor esistenti
- **SE Visible** (SE Ranking): traccia la visibilità nelle risposte AI reali, ma non analizza il contenuto né spiega perché
- **Rankscale.AI**: monitora visibilità e sentiment, ma score opaco senza metodologia trasparente
- **Profound**: focalizzato su brand enterprise, traccia share of voice AI ma non guida l'ottimizzazione dei contenuti
- **HubSpot GEO Tool**: grader gratuito ma superficiale, non basato sui meccanismi dei patent

### 6.2 Differenziazione di Visiblee
1. **Basato sui patent**: lo scoring replica i meccanismi documentati nei patent Google, non euristiche generiche
2. **Passage-level analysis**: analizza ogni singolo passaggio, non solo la pagina nel suo complesso
3. **Fan-out simulation**: simula attivamente le query sintetiche e misura la copertura
4. **Actionable-first**: ogni score genera raccomandazioni concrete con stima di impatto
5. **Trasparenza metodologica**: la metodologia è documentata e spiegata, non una black box
6. **Multi-progetto**: pensato per professionisti e agenzie che gestiscono più brand
7. **Accessibile**: wizard educativi e spiegazioni contestuali rendono il prodotto comprensibile anche a chi non è un esperto di AI search
8. **Multilingue**: interfaccia e contenuti AI generati in italiano e inglese
