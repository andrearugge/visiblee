# Learnings dalla v1 — Visiblee

> **Data**: Marzo 2026
> **Scopo**: documentare cosa ha funzionato, cosa no, e cosa cambieremmo. Materiale essenziale per valutare proposte v2 senza ripetere gli stessi errori.
> **Audience**: progetto Claude.ai — leggere prima di proporre nuove feature o architetture.

---

## 1. Cosa ha funzionato bene

### 1.1 Lo scoring euristico è la scelta giusta

La decisione di non usare LLM per lo scoring dei passaggi (AD-02) si è rivelata corretta su tutti i fronti:
- Costo marginale per analisi: ~$0.008 (embedding + fan-out). Con LLM sarebbe $20-30.
- I risultati sono ripetibili: lo stesso contenuto produce lo stesso score in esecuzioni diverse.
- I sub-criteri (position, entity density, statistical specificity, answer-first, source citation) sono interpretabili dall'utente — non black box.
- Nessun LLM "allucinante" valori falsi per passaggi su cui non ha contesto.

**Lo stesso principio si è applicato alla classificazione intent GSC**: regex euristiche IT+EN per `classify_intent()` producono risultati coerenti e deterministici su migliaia di query, a costo zero.

### 1.2 Il competitor gap analysis è il differenziatore vero

Il flow automatico "citation check → fetch competitor → analisi con stessa pipeline → confronto strutturale" è la funzione che genera il maggior "aha moment" negli utenti. È anche quella che nessun competitor accessibile fa oggi. Va protetta e migliorata, non semplificata.

### 1.3 StepLoader + useJobPolling come primitivi condivisi

Avere un pattern standardizzato per tutti i job asincroni (discovery, analisi, competitor, GSC sync) ha eliminato inconsistenze nell'UX dei loading states e ridotto il codice duplicato. Ogni nuovo job che verrà aggiunto dovrebbe usare gli stessi primitivi.

**Nota tecnica**: `useJobPolling` usa `useRef` internamente per `isDone`/`onDone` — garantisce che le callback usino sempre i valori più recenti senza richiedere la ricreazione dell'interval. I componenti che tracciano il completamento di un job devono interrogare lo status del job direttamente (es. `!data.analysisRunning`), non comparare timestamp snapshot — quel pattern è soggetto a race condition.

### 1.4 targetLanguage + targetCountry espliciti

Chiedere la lingua e il paese al setup, invece di auto-detectarli, ha prodotto analisi più accurate e ha ridotto i casi di "questa analisi non ha senso" da parte degli utenti. L'attrito del setup è basso; l'errore di un'analisi sbagliata è alto.

### 1.5 La preview landing-page come funnel top-of-funnel

Permettere all'utente di vedere un punteggio reale prima di registrarsi (con sezioni bloccate come CTA) è il flow di acquisizione più efficace. L'utente arriva già con un'aspettativa calibrata e i dati di "quanto sono lontano dall'ottimale" creano urgenza reale.

### 1.6 OAuth separato per GSC (AD-13)

Tenere il login OAuth (Auth.js) separato dalla connessione GSC si è rivelata la scelta corretta: gli utenti con account email/password possono comunque connettere GSC, e i token GSC hanno un lifecycle indipendente dalla sessione. Progettare l'integrazione come "secondo grant OAuth" distinto è il pattern corretto per qualsiasi futura integrazione (GA4, Search Ads, ecc.).

### 1.7 Crypto cross-compatible TypeScript/Python per token sensibili

Implementare AES-256-GCM con lo stesso formato in TypeScript (`lib/crypto.ts`) e Python (`crypto_utils.py`) prima di scrivere qualsiasi codice che tocchi i token ha evitato problemi di compatibilità. La chiave è in env var; il formato `<ivHex>:<authTagHex>:<ciphertextHex>` è autodescrittivo.

---

## 2. Cosa non ha funzionato / è più complicato del previsto

### 2.1 La discovery è rumorosa

Brave Search + Gemini classificazione trova molti contenuti irrilevanti. Il passo di conferma manuale (conferma/scarta) è necessario ma crea attrito. Il problema principale: la classificazione Gemini tra "contenuto owned" e "mention da terzi" fa errori su:
- Siti aggregatori che ripubblicano contenuti del brand
- Profili social con nome uguale ma non correlati
- Pagine di review con parziale contenuto del brand

**Possibile v2**: migliorare la classificazione con un passo aggiuntivo di verifica URL (controlla se l'URL è nel sitemap del sito dichiarato, o se il dominio corrisponde al brand URL).

### 2.2 Il pipeline Python è lento per contenuti lunghi

La segmentazione + embedding di pagine molto lunghe (articoli 5000+ parole) può richiedere 30-60 secondi per singolo contenuto. Con 20 contenuti, l'analisi completa raggiunge i 10+ minuti nel worst case.

**Causa**: il fetcher non limita il testo estratto prima della segmentazione, e i contenuti vengono processati sequenzialmente nonostante `asyncio` (alcune operazioni sono bloccanti).

**Possibile v2**: cap sui primi N caratteri per analisi (es. 8000 parole per contenuto) + processing parallelo dei contenuti.

### 2.3 I fanout queries si accumulano senza cleanup

Ogni analisi crea nuovi `FanoutQuery` con un `batchId`. I vecchi non vengono eliminati. Dopo 10 analisi, la tabella `fanout_queries` ha 10× il volume utile. Non è un problema critico in v1 (volumi bassi) ma diventa un problema di storage a scala.

**Fix v2**: DELETE before INSERT per i fanout queries, o retention policy (mantieni solo ultimi N batch per progetto).

### 2.4 Le raccomandazioni LLM non sono abbastanza specifiche

Le raccomandazioni generate (Claude/Gemini in `optimization`) tendono a essere troppo generiche ("aggiungi answer capsule") senza identificare il passaggio esatto da modificare e senza includere un esempio concreto di come dovrebbe apparire dopo.

**Causa**: il prompt non include il testo del passaggio specifico + il testo del competitor per confronto. Include solo i sub-score numerici.

**Fix v2**: passare al LLM il testo originale del passaggio + il testo del miglior passaggio competitor per la stessa query → raccomandazione con esempio concreto.

### 2.5 Lo score history non è ancora un KPI forte

Il grafico storico è implementato (Recharts LineChart con toggle sub-score) ma richiede minimo 2 snapshot per essere utile. Nella pratica, molti utenti eseguono l'analisi una volta e poi non la rieseguono — il grafico resta vuoto.

**Causa**: nessun trigger automatico per rieseguire l'analisi. La citation simulation è manuale.

**Fix v2 critico**: scheduled jobs per citation check settimanale + prompt al rientro "hai aggiornato contenuti? Riesegui l'analisi".

**La feature GSC parzialmente mitiga questo**: i profili audience e i suggerimenti di query creano un motivo ricorrente di visita all'app. Ma il problema alla radice (analisi mai riavviate) richiede auto-scheduling.

### 2.6 Il competitor analysis manca di sub-score strutturati

`Competitor` ha solo `avgPassageScore`. Un competitor analizzato non produce i 5 sub-score separati — solo un punteggio aggregato medio. Questo limita il gap report: si può confrontare "il tuo passaggio X ha Citation Power 34, il competitor ha 71" ma non "il competitor ha Brand Authority 80 vs il tuo 30".

**Schema fix v2**: aggiungere `CompetitorScore` table con gli stessi 5 sub-score di `ProjectScoreSnapshot`.

### 2.7 Non c'è rate limiting sul microservizio Python

Un utente (o bug) potrebbe triggerare centinaia di job in loop. Il Python non ha rate limiting per utente. In v1 con pochi utenti non è un problema; a scala diventa un rischio.

### 2.8 OAuth GSC setup richiede configurazione manuale fuori dall'app

Per usare GSC, l'utente deve:
1. Attivare "Google Search Console API" nella Google Cloud Console Library
2. Aggiungere `http://localhost:3000/api/gsc/callback` agli **Authorized redirect URIs** (non alle JavaScript Origins — campo diverso)
3. Aggiungere il scope `webmasters.readonly` negli scopes dell'OAuth consent screen

Questo setup è necessario solo in ambiente di sviluppo locale. In produzione va pre-configurato una volta sola sul Google Cloud project dell'app. Il problema emerge per sviluppatori che clonano il repo — la documentazione di setup deve essere molto esplicita su questi passaggi.

---

## 3. Cose che cambieremmo se partissimo da zero

### 3.1 Job queue separata (Redis/BullMQ) fin dall'inizio

Usare PostgreSQL come job queue è una scorciatoia accettabile in v1. In v2, i citation checks automatici settimanali (1 job per query per progetto × N utenti) richiedono una job queue vera con priority, retry exponential backoff, e dead letter queue. Meglio costruirla subito che migrare.

### 3.2 Separare `rawHtml` dal DB principale

Salvare l'HTML raw di ogni contenuto in PostgreSQL funziona ma gonfia il DB. Per 100 utenti con 20 contenuti ciascuno = 2.000 campi HTML da 10-500KB = potenzialmente centinaia di MB. Meglio S3/R2 per il raw content, DB solo per i metadati.

### 3.3 Modellare i piani fin dall'inizio (anche senza billing)

In v1, le regole dei piani (max 5 query free, no competitor analysis free) sono hardcoded nel codice. Non c'è un modello `Plan` o `Subscription` nel DB. Aggiungere billing significa aggiungere uno strato sopra a qualcosa che non è progettato per reggerne il peso.

**Fix v2**: aggiungere `plan` e `planLimits` all'utente fin dall'inizio, anche se il billing non è attivo.

### 3.4 Test di integrazione sulla pipeline Python

La pipeline Python non ha test automatici. Ogni refactoring è stata eseguita "a mano" verificando i risultati manualmente. Un test suite con contenuti fixture + expected scores avrebbe reso i refactoring molto più sicuri.

---

## 4. Decisioni che non cambieremmo

- **FastAPI separato**: la separazione frontend/backend è corretta. Non bundlare il Python in Next.js.
- **Gemini per citation check**: finché non esistono alternative ufficiali, è l'unica scelta sensata.
- **Voyage AI per embedding**: le performance su query-passage matching giustificano la scelta. Usato anche per i suggerimenti GSC (similarità tra query GSC e query target esistenti).
- **No LLM scoring**: la deterministica è un requisito non negoziabile per lo score history.
- **No URL prefix i18n**: routes in inglese, lingua da cookie. Funziona, non crea problemi.
- **Primitive condivise (StepLoader, useJobPolling)**: il pattern di astrazione è corretto e va mantenuto.
- **OAuth GSC separato da login OAuth**: pattern corretto da mantenere per qualsiasi futura integrazione.
- **AES-256-GCM per token OAuth**: non salvare mai token in chiaro in DB.

---

## 5. Segnali di prodotto dalla v1

Questi sono pattern osservati nel comportamento utente che dovrebbero guidare le priorità v2:

| Segnale | Implicazione |
|---|---|
| Gli utenti eseguono l'analisi 1 volta e non tornano | Il trigger automatico (citation check settimanale) è la feature di retention più urgente |
| Il gap report competitor è la feature "wow" | Va migliorata (sub-score completi, esempio concreto) prima di aggiungere feature nuove |
| La discovery manuale (conferma/scarta) è un attrito | Migliorare la classificazione automatica riduce l'abbandono nel setup |
| Le raccomandazioni sono percepite come "generiche" | Servono esempio concreto + collegamento al passaggio specifico |
| Il free tier (5 query) è troppo limitato per valutare il prodotto | Considerare 7-10 query nel free, con competitor analysis limitata invece che assente |
| I profili audience GSC creano engagement ricorrente | L'integrazione GSC è un driver di retention più forte dello score history da solo |
