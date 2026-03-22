# Algoritmo di scoring — documentazione tecnica

Questo documento descrive come Visiblee calcola l'**AI Readiness Score** e i cinque sotto-score che lo compongono. L'obiettivo non è elencare funzioni, ma spiegare le scelte tecniche, i trade-off che abbiamo incontrato e il perché di ogni approccio.

---

## Architettura generale

Il motore di scoring è un microservizio Python (FastAPI) separato dal frontend Next.js. La separazione è deliberata: le operazioni di embedding e scoring con LLM hanno latenze nell'ordine dei minuti, sono CPU/memoria intensive, e devono essere eseguibili in modo asincrono senza bloccare l'interfaccia utente.

L'analisi viene accodata come un **job** nella tabella `jobs` di PostgreSQL. Un worker Python autonomo esegue il polling ogni 5 secondi, preleva il job in modo atomico con `SELECT ... FOR UPDATE SKIP LOCKED` (nessuna race condition anche con più worker in parallelo), e lo elabora.

Il risultato viene scritto in un `ProjectScoreSnapshot`, un record immutabile che fotografa il momento dell'analisi. Questo consente di mostrare lo storico dei punteggi nel tempo senza che un'analisi successiva sovrascriva i dati precedenti.

---

## Il pipeline di analisi — 10 passi

### 0. Auto-fetch dei contenuti non scaricati

Prima di iniziare il calcolo, il pipeline verifica se ci sono contenuti confermati dall'utente ma non ancora scaricati (`lastFetchedAt IS NULL`). Se ne trova, li scarica e segmenta in background prima di procedere. Questo rende il flusso più robusto: l'utente può confermare dei contenuti e avviare l'analisi senza dover necessariamente passare prima dall'operazione di fetch manuale.

### 1. Caricamento dati

Il pipeline legge dal database:
- il profilo del progetto (URL, nome brand, lingua dell'utente)
- le **target query** attive definite dall'utente
- tutti i contenuti confermati e scaricati, con i loro passaggi già segmentati
- la distribuzione dei contenuti per piattaforma (per il cross-platform score)

### 2. Generazione fanout query

Le target query dell'utente (es. "come migliorare la SEO per AI") vengono espanse in un insieme più ampio di varianti semantiche tramite **Gemini 2.5 Flash**. Per ogni query target vengono generate 10 varianti (`FANOUT_PER_QUERY = 10`), incluse domande correlate, bisogni impliciti, query comparative ed esplorative.

La scelta di Gemini Flash per questo step è economica e pratica: è rapido, gestisce bene la generazione di query brevi, ed è chiamato in parallelo su tutte le target query con `asyncio.gather`. Il risultato è un corpus di query che rappresenta lo spazio semantico reale in cui i motori AI potrebbero cercare informazioni sul brand.

Con 15 target query (il limite massimo) e 10 fanout ciascuna, si arriva a un massimo di ~150 query. Questo è il punto di equilibrio tra copertura semantica e costo computazionale (ogni query deve essere embeddinga).

### 3. Embedding e fanout coverage score

Questo è il calcolo più costoso e tecnicamente interessante. Query e passaggi vengono embeddati tramite **Voyage AI** (modello `voyage-3-large`, vettori a 1024 dimensioni), un modello di embedding specializzato nel retrieval semantico asimmetrico: distingue tra `input_type="query"` e `input_type="document"`, il che migliora significativamente la qualità del matching rispetto a un embedding simmetrico generico come quello di OpenAI.

Per ogni query (target + fanout), il pipeline trova il passaggio con la **cosine similarity** più alta nell'insieme dei passaggi confermati. Se questa similarity supera una soglia configurabile (`COVERAGE_THRESHOLD = 0.60`), la query è considerata "coperta".

Il **Fanout Coverage Score** è semplicemente la frazione di query coperte:

```
fanout_coverage_score = n_query_coperte / n_query_totali
```

La soglia 0.60 è stata scelta empiricamente: sotto questa soglia la corrispondenza semantica è generalmente debole o ambigua; sopra, il passaggio risponde genuinamente alla query. È un parametro configurabile tramite env var per poterla tarare in produzione.

I vettori sono salvati in PostgreSQL con l'estensione **pgvector** per eventuali ricerche future, ma il calcolo durante l'analisi avviene interamente in memoria con NumPy per evitare roundtrip al database ad ogni confronto.

### 4. Passage quality score

I passaggi vengono valutati da **Claude Sonnet** (claude-sonnet-4-5) su cinque criteri, ciascuno con un punteggio da 0.0 a 1.0:

| Criterio | Cosa misura |
|---|---|
| `self_containedness` | Il passaggio è comprensibile senza contesto esterno? |
| `claim_clarity` | Le affermazioni sono specifiche e non ambigue? |
| `information_density` | Il rapporto segnale/rumore è alto? |
| `completeness` | Il passaggio tratta il suo argomento in modo esaustivo? |
| `verifiability` | Cita fatti, dati o fonti nominative? |

La scelta di Claude per questo compito (invece di Gemini, usato per le fanout query) è tecnica: Claude è più calibrato nella valutazione qualitativa di testo e produce JSON più affidabile con meno tentativi di parsing. La risposta attesa è esclusivamente un oggetto JSON — zero markdown, zero testo libero — e viene estratta con regex anche se il modello aggiunge testo intorno.

Per contenere i costi, il pipeline seleziona al massimo **10 passaggi** tra tutti quelli disponibili, ordinati per word count decrescente (proxy per la ricchezza informativa). Le chiamate API sono eseguite in parallelo con un semaforo a 3 slot concorrenti per rispettare i rate limit.

Il punteggio finale è la media aritmetica degli `overall_score` dei passaggi valutati, dove `overall_score = mean(cinque criteri)`.

### 5. Chunkability score

Questo score è **completamente euristico**, senza LLM. Misura quanto il contenuto è strutturato in modo ottimale per essere estratto da un motore AI.

Per ogni passaggio vengono calcolati tre sub-criteri:

1. **Word count** (peso 50%): la finestra ottimale è 134–167 parole. Dentro la finestra → 1.0. Tra 80–134 o 167–250 → 0.7. Fuori → 0.4. Questi range derivano dalla ricerca sui chunk ottimali per RAG (Retrieval-Augmented Generation) nei modelli linguistici moderni.

2. **Presenza di heading** (peso 25%): un passaggio preceduto da un heading strutturato è più facilmente indicizzabile → 0.8, altrimenti → 0.4.

3. **Answer-first structure** (peso 25%): la prima frase deve essere sostanziale (≥8 parole). I motori AI tendono a citare frasi iniziali dei passaggi; un attacco debole penalizza la citabilità → 0.8 se sostanziale, 0.4 altrimenti.

La scelta di non usare un LLM qui è intenzionale: la chunkability è strutturale, non semantica, e un'analisi lessicale/statistica è più veloce, riproducibile e spiegabile all'utente.

### 6. Entity coherence score

Misura quanto il brand è riconoscibile e terminologicamente coerente attraverso i propri contenuti. Anche questo score è euristico, con due componenti:

1. **Brand presence** (peso 60%): quante delle pagine confermate menzionano esplicitamente il nome del brand? Una presenza del 100% → score 1.0. Molti brand dimenticano di nominare se stessi nei contenuti secondari (blog post, LinkedIn, ecc.), abbassando questo segnale.

2. **Term consistency** (peso 40%): quanti termini significativi (≥4 caratteri) appaiono in almeno 2 pagine diverse? La coerenza lessicale cross-pagina è un segnale di entity establishment: più un termine appare in contesti diversi, più è probabile che i modelli AI lo associno al brand. Il punteggio satura a 20 termini condivisi (score 1.0) — una soglia realisticamente raggiungibile per un sito con 5–10 pagine.

### 7. Cross-platform score

Il più semplice dei cinque: misura la presenza confermata del brand su 6 piattaforme non-website:

```
KNOWN_PLATFORMS = ["linkedin", "reddit", "medium", "youtube", "substack", "news"]
cross_platform_score = piattaforme_con_contenuto / 6
```

La logica è che i motori AI costruiscono la loro "conoscenza" di un'entità aggregando segnali da fonti diverse. Un brand presente solo sul proprio sito ha bassa authority agli occhi di un modello linguistico rispetto a uno che appare su LinkedIn, YouTube e testate giornalistiche. Questo è direttamente ispirato ai patent di Google sull'entity authority nelle AI Overview.

### 8. Composite AI Readiness Score

I cinque score vengono combinati in un punteggio composito con pesi fissi:

| Dimensione | Codice | Peso |
|---|---|---|
| Query Reach | `fanout_coverage_score` | **25%** |
| Answer Strength | `passage_quality_score` | **25%** |
| Extractability | `chunkability_score` | **20%** |
| Brand Trust | `entity_coherence_score` | **15%** |
| Source Authority | `cross_platform_score` | **15%** |

La scelta dei pesi riflette l'importanza relativa che assegnamo a ciascuna dimensione nell'attuale paradigma dei motori AI: la copertura semantica (fanout) e la qualità intrinseca delle risposte (passage quality) sono i segnali più forti, con peso paritario. La chunkability segue perché impatta direttamente l'estraibilità dei passaggi. Brand trust e cross-platform hanno peso minore ma non trascurabile, in quanto segnali "di contorno" che confermano l'identità dell'entità.

I pesi sono costanti nel codice (`SCORE_WEIGHTS` in `scoring.py`) ma progettati per essere tarabile in futuro tramite backtesting su dataset di citazioni reali.

### 9. Generazione insights e raccomandazioni

In parallelo (`asyncio.gather`) vengono generati:

- **Insights**: 3–4 bullet point narrativi che spiegano cosa significano i punteggi per il brand specifico, generati da Claude con fallback su Gemini.
- **Raccomandazioni**: 5–8 azioni prioritizzate, classificate per tipo (`quick_win`, `content_gap`, `platform_opportunity`), priorità (`high/medium/low`) e sforzo stimato (`quick/moderate/significant`). Il prompt istruisce esplicitamente il modello a concentrarsi sulle dimensioni con punteggio più basso.

Le raccomandazioni vengono salvate in una tabella separata con un proprio ciclo di vita (stato `pending → in_progress → completed`), disaccoppiato dallo snapshot.

### 10. Persistenza

Il salvataggio è strutturato in tre livelli di criticità:

1. **Core** (transazione principale): `ProjectScoreSnapshot` + `PassageScore` + `ContentScore`. Se questa transazione fallisce, il job viene marcato come failed e ritentato.
2. **Non-critico** (transazione separata): raccomandazioni. Un fallimento qui non invalida il risultato — viene loggato come warning.
3. **Non-critico** (transazione separata): fanout queries + coverage map. Utile per la pagina Opportunity Map, ma non essenziale per i punteggi.

Questa stratificazione garantisce che un errore nella generazione delle raccomandazioni non faccia perdere i dati di scoring, che sono la parte più costosa da ricalcolare.

---

## Segmentazione dei passaggi

Prima che i contenuti possano essere scorati, devono essere segmentati. Il segmentatore (`segmenter.py`) lavora sull'HTML grezzo con BeautifulSoup:

1. Rimuove i tag di navigazione e UI (`nav`, `footer`, `header`, `aside`, `script`, `style`, `form`).
2. Scorre i tag semantici (`h1–h4`, `p`, `li`) in ordine DOM.
3. Accumula il testo in un buffer, flushing ogni volta che si supera la soglia di ~150 parole o si incontra un nuovo heading.
4. I passaggi più lunghi di 300 parole vengono spezzati in chunk da 150 parole.
5. I passaggi sotto i 30 parole vengono scartati (troppo brevi per essere informativi).

Il range target 134–167 parole non è casuale: è la finestra ottimale documentata in letteratura per la RAG (Retrieval-Augmented Generation) nei modelli transformer. Passaggi più brevi perdono contesto; passaggi più lunghi diluiscono il segnale semantico durante l'embedding.

---

## Parallelismo e gestione dei costi

Una delle sfide principali nella progettazione del pipeline è stato bilanciare velocità e costo delle API esterne. Le soluzioni adottate:

- **Embedding in batch**: Voyage AI accetta batch fino a 128 testi per richiesta. Query e passaggi vengono embeddati in due chiamate parallele (una per le query, una per i passaggi), non in N+M chiamate singole.
- **Scoring dei passaggi con semaforo**: Le chiamate a Claude per la passage quality usano `asyncio.Semaphore(3)` — massimo 3 richieste concorrenti. Evita di saturare i rate limit senza serializzare l'intera operazione.
- **Fanout query in parallelo**: Ogni target query viene espansa da Gemini in modo indipendente, tutte le chiamate partono simultaneamente con `asyncio.gather`.
- **Heuristic first**: Chunkability ed entity coherence non chiamano nessuna API esterna — sono calcoli sincroni eseguiti mentre il task asincrono delle fanout query è in attesa. Questo sfrutta il tempo di attesa invece di serializzare.
- **Selezione dei passaggi da scorare**: Invece di mandare tutti i passaggi a Claude (potenzialmente centinaia), il pipeline seleziona i 10 più lunghi come proxy di ricchezza. Con 5 criteri e max_tokens=200 per passaggio, il costo di scoring è prevedibile e contenuto.

---

## Modelli AI utilizzati

| Compito | Modello | Motivazione |
|---|---|---|
| Fanout query | Gemini 2.5 Flash | Veloce, economico, ottimo per generazione lista |
| Passage quality | Claude Sonnet 4.5 | Più affidabile nel JSON strutturato e nella valutazione qualitativa |
| Insights | Claude Sonnet 4.5 (fallback: Gemini) | Claude produce prose più calibrata; Gemini come fallback se non disponibile |
| Raccomandazioni | Claude Sonnet 4.5 (fallback: Gemini) | Stessa logica degli insights |
| Embedding | Voyage voyage-3-large | Specializzato nel retrieval semantico asimmetrico query→document |

---

## Parametri configurabili

Tutti i parametri di tuning sono esposti come variabili d'ambiente, senza hardcoding nel codice di business:

| Variabile | Default | Effetto |
|---|---|---|
| `COVERAGE_THRESHOLD` | `0.60` | Soglia cosine similarity per considerare una query "coperta" |
| `FANOUT_PER_QUERY` | `10` | Varianti generate per ogni target query |
| `MAX_PAGES_TO_FETCH` | `8` | Numero massimo di pagine scaricate nel pipeline preview |
| `WORKER_POLL_INTERVAL` | `5` | Secondi tra un polling del worker e il successivo |

---

## Cosa non facciamo (e perché)

**Non usiamo un LLM per stimare la probabilità di citazione diretta.** Sarebbe computazionalmente proibitivo su larga scala e soggetto ad allucinazioni. Invece modelliamo i segnali documentati che i motori AI usano per selezionare le fonti (copertura semantica, qualità strutturale, coerenza di brand, presenza cross-platform).

**Non analizziamo il ranking in tempo reale su ChatGPT o Perplexity.** Questo richiederebbe scraping dei motori AI, in violazione dei loro ToS. Il nostro approccio misura la qualità dell'input (il contenuto del brand) piuttosto che l'output (se viene citato in questo momento).

**Non facciamo re-ranking con BM25 o full-text search.** Il retrieval è esclusivamente vettoriale. Per il caso d'uso di Visiblee — matching semantico tra query ipotetiche e passaggi — la cosine similarity su embeddings di alta qualità supera i metodi lessicali, specialmente per query formulate in modo diverso rispetto al testo dei passaggi.
