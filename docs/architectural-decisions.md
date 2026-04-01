# Decisioni Architetturali — Visiblee

> **Data**: Marzo 2026
> **Scopo**: documentare le scelte non ovvie con la loro motivazione. Prima di proporre alternative, verificare che non siano già state valutate e scartate.
> **Audience**: progetto Claude.ai + chiunque contribuisca al prodotto.

---

## AD-01 — FastAPI separato invece di API Routes Next.js

**Decisione**: la pipeline di analisi (discovery, scoring, citation check, GSC sync) vive in un microservizio Python su Hetzner separato da Vercel.

**Motivazione**:
- La pipeline usa librerie Python-native: `numpy`, `scipy` (cosine similarity batch), `trafilatura` (content extraction), `sentence-transformers` (embedding locale opzionale), `beautifulsoup4`.
- L'analisi di 20 contenuti × 30 passaggi richiede 3-8 minuti: troppo per il timeout delle Vercel Functions (max 60s pro, 300s enterprise).
- pgvector e le operazioni vettoriali batch sono più efficienti da Python che da un ORM TypeScript.
- Il costo computazionale giustifica un server dedicato (Hetzner CX31, ~€10/mese) invece di functions serverless pagate per invocazione.

**Implicazione**: ogni nuova funzione che richiede NLP, embedding, o computazione lunga va nel microservizio Python, non in Next.js API Routes. Le API Routes Next.js sono solo per operazioni DB semplici e orchestrazione job.

---

## AD-02 — Scoring euristico, zero LLM nel loop di scoring

**Decisione**: tutti e 5 i sub-score sono calcolati con algoritmi deterministici (regex, NLP leggero, cosine similarity). Nessun LLM nel loop di scoring dei passaggi.

**Motivazione**:
- **Costo**: 20 contenuti × 30 passaggi × 5 sub-criteri = 3.000 chiamate LLM per analisi. A $0.01/call = $30/analisi. Non sostenibile.
- **Determinismo**: lo scoring deve produrre lo stesso risultato sullo stesso contenuto per poter tracciare trend nel tempo. I LLM non sono deterministici.
- **I segnali sono misurabili euristicamente**: position (indice nel doc), entity density (NER leggero o heuristic), statistical specificity (regex numeri + unità misura + attribuzioni), definiteness (verbi decisionali, certezze), answer-first (pattern "X è/sono/significa..." nelle prime 2 righe), source citation (pattern "secondo X", "[fonte]", "studio del [anno]").

**LLM usati**: solo per fan-out (Gemini) e raccomandazioni (Claude/Gemini). Mai per scoring.

**Stesso principio si applica alla classificazione intent GSC** (AD-15): la classificazione dei query intent usa regex euristiche, non LLM.

**Implicazione**: se si propone di "usare un LLM per valutare meglio i passaggi", la risposta è no. Il sistema è progettato esplicitamente per evitarlo.

---

## AD-03 — Gemini API con Google Search Grounding per citation check

**Decisione**: la citation verification usa esclusivamente la Gemini API con `google_search` tool abilitato.

**Motivazione**:
- È l'unica API ufficiale che restituisce citazioni Google strutturate in JSON (`grounding_supports` con `web`, `uri`, `title`, `supportedText`).
- Costo ~$0.01-0.03 per query: sostenibile.
- Legale: non viola ToS, non è scraping.
- ChatGPT e Perplexity non hanno API equivalenti.

**Alternative valutate e scartate**:
- Scraping SERP Google → ToS violation, fragile, costo di manutenzione alto.
- "Chiedere all'AI se conosce il brand" (ChatGPT senza grounding) → inaffidabile (<1% consistenza tra risposte consecutive, SparkToro 2026).
- SerpAPI / ValueSERP per AI Overviews → non restituiscono fonti strutturate, solo testo della risposta.

**Implicazione**: finché non esistono API equivalenti per ChatGPT/Perplexity, il citation check è solo Google. Non proporre alternative che violano ToS o che sono strutturalmente meno affidabili.

---

## AD-04 — Voyage AI per embedding, non OpenAI/Cohere

**Decisione**: embedding generati con Voyage AI `voyage-3` (dim 1024).

**Motivazione**:
- Voyage AI ha performance superiori su task di retrieval rispetto a `text-embedding-3-large` di OpenAI su benchmark MTEB, in particolare per task di query-passage matching (il caso d'uso principale).
- Costo inferiore a OpenAI large per volume: ~$0.0001/1K token vs $0.00013/1K.
- Dimensione 1024: buon trade-off tra qualità e storage (pgvector).

**Implicazione**: se si aggiunge un nuovo use case che richiede embedding (inclusa la similarità GSC query per i suggerimenti di nuove query target), usare Voyage AI. Non mescolare provider.

---

## AD-05 — pgvector su PostgreSQL invece di database vettoriale dedicato

**Decisione**: i vettori sono salvati in PostgreSQL con l'estensione pgvector (`Unsupported("vector(1024)")` in Prisma).

**Motivazione**:
- Un database vettoriale separato (Pinecone, Weaviate, Qdrant) aggiunge un servizio da gestire, un costo fisso mensile, e complessità di sincronizzazione con il DB principale.
- Il volume di vettori in v1 non giustifica un DB dedicato: max ~10.000 passaggi per utente attivo, operazioni batch una volta al mese.
- pgvector con HNSW index è sufficiente per query realtime a questo volume.
- Lo stesso server PostgreSQL su Hetzner ospita già il DB relazionale.

**Quando riconsiderare**: se la base utenti supera 1.000 progetti attivi con analisi frequenti, valutare il passaggio a un DB vettoriale dedicato per le query di similarity search.

---

## AD-06 — Brave Search API per discovery (non Google Search API / SerpAPI)

**Decisione**: la discovery dei contenuti usa Brave Search API (8 ricerche parallele).

**Motivazione**:
- Google Custom Search API ha un limite di 100 query/giorno nella versione gratuita e $5/1000 query nella versione pro. Per 8 ricerche parallele per ogni discovery, i costi scalano rapidamente.
- Brave Search API è $3/1000 query e non ha limiti restrittivi. Per il volume attuale, il costo è trascurabile.
- Brave restituisce risultati di qualità paragonabile a Google per query informative (non SERP personalizzata).
- Il `country` e `search_lang` di Brave supportano la market-aware discovery.

**Implicazione**: non sostituire con Google Search API salvo cambiamenti drastici di pricing Brave o requisiti di qualità impossibili da soddisfare.

---

## AD-07 — Next-intl senza URL prefix

**Decisione**: le route sono sempre in inglese (`/app/projects/[id]/overview` non `/it/app/...`). La lingua è determinata da `Accept-Language` → cookie `NEXT_LOCALE` → fallback `en`.

**Motivazione**:
- Un SaaS tool non ha bisogno di URL diversi per lingua: l'URL di un progetto è lo stesso per un utente italiano e uno inglese.
- URL prefix crea complessità nelle redirect, nei link condivisi, nell'auth flow.
- La lingua è una preferenza utente, non una proprietà della route.

**Regole hard**:
- Mai aggiungere `/[locale]/` alle route. Mai.
- Il selettore lingua sta nel footer del marketing site e nella pagina Settings dell'area autenticata. Nessun altro posto.
- I contenuti AI-generated (insights, raccomandazioni) usano `language` come parametro al LLM, non cambiano URL.

---

## AD-08 — Auth.js v5 con JWT (no DB sessions)

**Decisione**: sessioni JWT stateless, non salvate in DB.

**Motivazione**:
- Le DB sessions richiedono una tabella `sessions` con cleanup periodico e query ad ogni request.
- Per un SaaS con un solo tier di utenti (no revoke istantaneo necessario), JWT è sufficiente.
- Riduce le query DB per request autenticata.

**Limitazione**: il logout non invalida il token immediatamente (JWT non è revocabile prima della scadenza). Accettabile per v1.

---

## AD-09 — Job queue su DB PostgreSQL (no Redis/BullMQ)

**Decisione**: i job asincroni sono in una tabella `jobs` su PostgreSQL, con polling dal frontend e worker Python che le consuma.

**Motivazione**:
- Redis + BullMQ aggiungono un servizio da gestire su Hetzner.
- Il volume di job in v1 è basso (decine al giorno, non migliaia).
- La latenza di una job queue DB è ampiamente sufficiente per job che durano 3-8 minuti.
- Nessuna garanzia di delivery complessa necessaria: se un job fallisce, l'utente può ritriggerare manualmente.

**Quando riconsiderare**: se si aggiungono job schedulati frequenti (citation checks automatici settimanali per migliaia di utenti), Redis + BullMQ o una soluzione equivalente sarà necessaria. Il tipo `gsc_sync` e `citation_check_enriched` sono attualmente manuali; se diventano schedulati a larga scala, questa decision va rivalutata.

---

## AD-10 — targetLanguage e targetCountry espliciti (no auto-detection)

**Decisione**: l'utente specifica esplicitamente lingua e paese del mercato target al setup del progetto.

**Motivazione**:
- Auto-detection dalla lingua del sito funziona nel 70% dei casi ma fallisce per siti multilingua, brand internazionali con contenuti in inglese ma mercato italiano, ecc.
- L'errore è costoso: misurare copertura italiana con query inglesi produce risultati inutili.
- L'esplicitazione è un segnale di onestà: "stiamo misurando la tua visibilità AI in questo specifico mercato", non una generica "visibilità globale".

**Utilizzo**: `targetLanguage` viene passato a Gemini per il fan-out, a Brave come `search_lang`, nei prompt del citation check, e nella classificazione intent GSC (`classify_intent()`). `targetCountry` viene passato a Brave come `country`.

---

## AD-11 — Limite 15 query target per progetto

**Decisione**: massimo 15 query target per progetto (5 nel free tier).

**Motivazione computazionale**:
- 15 query × 10 fanout = 150 sotto-query + 15 originali = 165 query da embeddare.
- 20 contenuti × 30 passaggi = 600 passaggi.
- 165 × 600 = 99.000 confronti cosine similarity — gestibile in batch NumPy in memoria.
- Oltre 15 query: tempo analisi e costi embedding crescono linearmente, UX degradata.

**Motivazione commerciale**: il limite 5 → 15 è uno dei principali driver di upgrade free → pro.

---

## AD-12 — Competitor analysis automatico dai citation checks

**Decisione**: ogni fonte citata da Gemini per le query target che non è il sito dell'utente viene tracciata come potenziale competitor e analizzata.

**Motivazione**:
- I competitor per le citazioni AI non coincidono con i competitor di business: spesso sono blog di settore, aggregatori, think tank.
- L'utente non sa a priori chi sono questi competitor.
- Trovare i competitor manualmente è un lavoro che l'utente non farebbe.
- Il gap report automatico (fetch → analisi → confronto strutturale) è il differenziatore più forte del prodotto.

**Implicazione**: ogni miglioramento alla citation verification si riverbera automaticamente sulla qualità del competitor analysis.

---

## AD-13 — OAuth GSC separato dall'auth di login

**Decisione**: la connessione a Google Search Console usa un OAuth flow separato da quello di login (Auth.js). Scope: `webmasters.readonly`. Tokens salvati nella tabella `gsc_connections`, non nella sessione utente.

**Motivazione**:
- Il scope `webmasters.readonly` per GSC non deve contaminare la sessione di autenticazione principale — sono due trust context diversi.
- Un utente potrebbe avere login via email/password (nessun Google OAuth) ma voler connettere GSC su un Google Account diverso da quello con cui potrebbe fare login.
- I token GSC devono essere refresh-abili indipendentemente dalla sessione utente (che è stateless JWT).
- Il lifecycle dei token GSC (revocabili dall'utente da Google Dashboard, scadenza refresh token dopo 6 mesi inattività) è diverso dal lifecycle della sessione.

**Implicazione**: non proporre di "riutilizzare il token Google dalla sessione Auth.js" per il GSC. Sono due OAuth grant distinti con scope, lifecycle e storage separati.

---

## AD-14 — AES-256-GCM per i token OAuth GSC (non in chiaro in DB)

**Decisione**: `accessToken` e `refreshToken` GSC vengono cifrati con AES-256-GCM prima di essere salvati in `gsc_connections`. La chiave è in variabile d'ambiente (`GSC_TOKEN_ENCRYPTION_KEY`). Formato: `<ivHex>:<authTagHex>:<ciphertextHex>`.

**Motivazione**:
- I token OAuth di un GSC che contiene dati reali di traffico (query, impressioni, CTR) sono dati sensibili. Un dump del DB non espone i token in chiaro.
- AES-256-GCM è authenticated encryption: rileva manomissioni del ciphertext (autenticità + confidenzialità).
- Lo stesso algoritmo è implementato in TypeScript (`lib/crypto.ts`, Node.js `crypto`) e Python (`services/analyzer/app/crypto_utils.py`, libreria `cryptography`), con formato token cross-compatible.

**Implicazione**: non salvare mai token OAuth in chiaro nel DB. Se si aggiungono altre integrazioni OAuth (es. future API di ChatGPT, GA4), usare lo stesso schema con la stessa utility di crypto.

---

## AD-16 — Modello bayesiano Beta(α,β) per il citation rate

**Decisione**: il tasso di citazione per query è stimato con un modello bayesiano Beta(α,β) con prior uniforme Beta(1,1), non con una media semplice.

**Motivazione**:
- Una media semplice è fuorviante con pochi check: 1 citazione su 1 check → 100%, ma l'incertezza è altissima. Il modello bayesiano incorpora questa incertezza nell'intervallo di confidenza.
- Prior uniforme Beta(1,1) = "non sappiamo nulla a priori". Equivale a inizializzare con 1 successo e 1 fallimento virtuali. Anche con un solo check reale il risultato è una stima sensata (e.g. 1/3 check citato → rate ≈ 67%, IC 95% largo).
- Con molti check l'IC si stringe e il rate converge alla frequenza reale: il comportamento asintotico è identico alla media semplice.
- La larghezza dell'IC fornisce direttamente la label di stabilità (stable/learning/uncertain) senza soglie arbitrarie sul numero di check.

**Implementazione**: `lib/citation-stats.ts` (TypeScript, usato dalla page e dall'endpoint) e `services/analyzer/app/citation_stats.py` (Python, reference). Approssimazione normale del posterior Beta: valida per n ≥ 3, accettabile da n = 1.

**Implicazione**: non sostituire con media semplice o Wilson score. Tutti i componenti UI che mostrano il citation rate devono usare `computeCitationStats()` dalla utility condivisa, non calcolare la media direttamente.

---

## AD-17 — Scheduler come processo cron separato (no job interno al worker)

**Decisione**: la creazione di job pianificati (citation daily, GSC sync, full analysis) avviene in `app/scheduler.py`, eseguito da Ploi come cron separato dal worker.

**Motivazione**:
- Il worker è un loop infinito che consuma job. Aggiungere logica di scheduling al worker creerebbe un accoppiamento tra consumo e produzione di job, complicando recovery, restart e monitoring.
- Un cron esterno è più prevedibile: si esegue, crea job, esce. Il worker non sa nulla della pianificazione.
- Il campo `scheduledAt` su `Job` + il filtro `AND ("scheduledAt" IS NULL OR "scheduledAt" <= NOW())` in `claim_job()` disaccoppiano completamente creazione da esecuzione: i burst job vengono creati tutti in anticipo (21 per query) e il worker li raccoglie mano a mano che scadono.

**Implicazione**: non aggiungere timer o logica temporale al worker. Se serve un nuovo tipo di job pianificato, aggiungerlo a `scheduler.py`. Il worker deve solo consumare.

---

## AD-15 — Classificazione intent GSC con euristiche (no LLM clustering)

**Decisione**: la classificazione dell'intent delle query GSC (`classify_intent()` in `intent_engine.py`) usa pattern regex per IT e EN. La generazione dei profili audience (`generate_intent_profiles()`) raggruppa per tipo di intent. Nessun LLM.

**Motivazione**:
- Un progetto GSC ha tipicamente 1.000-50.000 query da classificare. A $0.001/query LLM = $1-50 per sync. Non sostenibile.
- I tipi di intent rilevanti per Visiblee (informational, comparative, decisional, local, product, query_ai_mode) sono distinguibili con pattern lessicali: domande aperte (informational), "vs/alternativa/differenza" (comparative), "migliore/scegliere/prezzo" (decisional), "vicino a me" (local).
- Determinismo: lo stesso corpus di query deve produrre gli stessi profili audience, per poter confrontare tra sync successivi.

**Implicazione**: non introdurre chiamate LLM nella pipeline `gsc_sync` o `intent_engine`. La classificazione deve rimanere euristica.
