# Visiblee v2 — Specifiche UX e Architettura

> **Data**: 30 Marzo 2026
> **Stato**: bozza v5 — pricing semplificato confermato (Free generoso + Pro €99/mese)
> **Scopo**: documento di riferimento per la ristrutturazione UX di Visiblee. Unifica le sessioni di analisi (7 punti originali + modello query-centrico + feedback + modello bayesiano citazioni + pricing).
> **Prerequisiti**: leggere `product-state.md`, `architectural-decisions.md`, `v1-learnings.md` prima di implementare.

---

## 1. Cambio di paradigma

### 1.1 Da tool on-demand a monitoraggio continuo

Il prodotto oggi è costruito come un tool di analisi on-demand: l'utente esegue un'azione, riceve un risultato, poi se ne dimentica. L'obiettivo è trasformarlo in un tool di monitoraggio continuo con workflow guidato: il prodotto lavora anche quando l'utente non c'è, e quando torna trova dati nuovi e azioni concrete.

Le feature esistenti coprono già la maggior parte dei casi d'uso. Quello che manca è il collante: flusso guidato, scheduling automatico, output azionabili, navigazione che riflette il modo in cui l'utente pensa.

### 1.2 Da progetto-centrico a query-centrico (ibrido)

Oggi la navigazione è piatta: Overview, Queries, Contents, Opportunities, Optimization, Competitors. Tutto è globale al progetto, tutto è mescolato. L'utente deve fare il lavoro mentale di separare i contesti.

La nuova architettura è **ibrida query-centrica**:

- Il **progetto** resta il guscio: brand, contenuti, configurazione, audience.
- La **query** diventa il contenitore operativo: per ogni query, l'utente vede coverage, citation, competitor e raccomandazioni specifici per quel contesto.
- Il **contenuto** è il ponte trasversale: ogni contenuto "sa" quali query serve e con quale efficacia.
- L'**overview** è la vista aggregata che produce intelligenza cross-query: conflitti tra raccomandazioni, trend globali, KPI compositi.

---

## 2. Navigazione

### 2.1 Sidebar approvata

```
Overview           ← vista aggregata + conflitti cross-query + wizard onboarding
Contents           ← vista per-contenuto trasversale
Audience           ← personas (GSC + manuali)
Queries            ← lista query target
  └ Query X        ← coverage, citation, competitor, recs per QUESTA query
  └ Query Y
  └ ...
GEO Expert         ← sezione chat con LLM per azionare i suggerimenti
Project Settings
```

### 2.2 Logica di navigazione

**Overview**: il primo luogo dove l'utente atterra. Mostra l'AI Readiness Score composito, i trend, e soprattutto i conflitti cross-query ("l'articolo X riceve raccomandazioni contraddittorie dalle query A e B — considera di dividerlo"). Include il wizard di onboarding per i nuovi progetti.

**Contents**: vista trasversale per contenuto. Per ogni contenuto: quali query serve, con quale efficacia, score per passaggio. Se un contenuto ha conflitti cross-query, li segnala qui.

**Audience**: personas auto-generate da GSC + personas manuali. Sezione a bassa priorità implementativa ma presente nella navigazione fin dall'inizio.

**Queries**: lista delle query target con badge di stato (citato/non citato, citationRate se disponibile). Ogni query è cliccabile e apre il suo contenitore con 4 sotto-sezioni:
- **Coverage**: fanout queries + coverage map (verde/giallo/rosso) con azioni
- **Citation**: risultato simulazione, trend, fonti citate, varianti per audience
- **Competitors**: competitor citati per QUESTA query, gap report, ranking
- **Recommendations**: suggerimenti specifici per questa query, con CTA "Ottimizza con GEO Expert"

**GEO Expert**: sezione generica a livello di progetto che lista tutte le conversazioni avviate dall'utente per azionare i suggerimenti. Ogni conversazione è un thread chat-style con contesto iniettato.

**Project Settings**: configurazione progetto, GSC, lingua/paese.

---

## 3. I 7 interventi — versione definitiva con feedback

### 3.1 Creazione progetto + onboarding

**Decisione**: wizard inline su ogni pagina + wizard in Overview.

**Cosa cambia rispetto a oggi**:

- **GSC al momento della creazione**: lo step 1 del wizard propone di connettere GSC prima di inserire le query. Se l'utente connette, il primo sync parte in background. Se non connette, skip chiaro.
- **Query suggestions come primo touchpoint**: con GSC connesso, il tool propone query da monitorare basate su dati reali prima della discovery.
- **Onboarding progressivo, non modale**: ogni pagina mostra un banner persistente "Step N di M" se il setup non è completo. Il `SetupChecklist` esistente va reso pervasivo su tutte le pagine, non solo in Overview.
- **Wizard anche in Overview**: quando l'utente entra nel progetto dopo averlo creato, l'Overview mostra il wizard per guidarlo al passo successivo. Questo è il punto di ingresso principale — deve essere immediatamente chiaro cosa fare.

**Flusso di setup proposto**:

```
1. Crea progetto (nome, brand, URL, lingua, paese)
2. [Opzionale] Connetti GSC → sync in background
3. Aggiungi query target (con suggerimenti GSC se disponibili)
4. Avvia discovery contenuti
5. Conferma contenuti (facilitato da sitemap se disponibile)
6. Avvia prima analisi
```

Ogni step corrisponde a un checkpoint nel banner di onboarding. Il banner scompare quando tutti gli step sono completati.

**Impatto tecnico**: ristrutturare il flow post-creazione progetto. Il `SetupChecklist` esiste già — va reso un componente che appare in tutte le pagine del progetto (non solo Overview) finché il setup non è completo.

---

### 3.2 Check contenuti + confidence + sitemap

**Decisione**: tutto approvato come proposto nella prima sessione.

**Confidence visibile**: mostrare `discoveryConfidence` (già nel DB) come badge alta/media/bassa nella UI di revisione contenuti. Ordinamento per confidence decrescente di default. Filtro rapido "Mostra solo bassa confidence" per la pulizia veloce.

**Filtro lingua automatico**: aggiungere `detectedLanguage` al modello `Content`. Se diversa da `targetLanguage`, badge "Lingua diversa dal target" nella UI. Il detection può avvenire nel classificatore Gemini durante la discovery (già classifica, basta aggiungere la lingua al prompt).

**Import da sitemap**: pulsante "Importa da sitemap" nella sezione Contents.
- Il tool scarica `sitemap.xml`, estrae URL, li incrocia con quelli già in DB
- Contenuti da sitemap: `source: 'sitemap'`, `contentType: 'own'`, `isConfirmed: true` (auto-confermati)
- Nuovo job type: `'sitemap_import'`
- Schema: estendere `Content.source` con valore `'sitemap'`

---

### 3.3 Analisi e output azionabili + GEO Expert

**Decisione**: le raccomandazioni diventano azionabili con due livelli — azione rapida nella query e conversazione approfondita nel GEO Expert.

#### 3.3.1 Opportunity Map con azioni (dentro ogni query)

Ogni gap nella coverage map ha 3 azioni:

1. **"Migliora contenuto esistente"**: link al contenuto più vicino con passaggio da migliorare evidenziato + raccomandazione specifica
2. **"Crea nuovo contenuto"**: genera un brief (titolo, H2 suggeriti, answer capsule template, entità da includere) — CTA "Approfondisci con GEO Expert"
3. **"Non rilevante"**: dismiss con feedback → migliora il fanout futuro

#### 3.3.2 Recommendations azionabili (dentro ogni query)

Le raccomandazioni sono contestualizzate alla query. Per ogni tipo:

- **`quick_win`**: mostra passaggio attuale + esempio ottimizzato (dal competitor migliore per questa query). CTA: "Ottimizza con GEO Expert"
- **`content_gap`**: propone brief strutturato. CTA: "Sviluppa con GEO Expert"
- **`platform_opportunity`**: mini-guida operativa (3-4 step). CTA: "Approfondisci con GEO Expert"

#### 3.3.3 GEO Expert — sezione chat con LLM

**Concept**: sezione a livello di progetto (`/app/projects/[id]/expert`) che lista tutte le conversazioni avviate dall'utente per azionare suggerimenti.

**Flusso**:

1. L'utente è nella query X → vede una raccomandazione → clicca "Ottimizza con GEO Expert"
2. Si apre una nuova conversazione nel GEO Expert con il contesto pre-caricato:
   - La raccomandazione specifica (tipo, titolo, descrizione, azione suggerita)
   - I dati della query (coverage, citation status, competitor citati)
   - Il contenuto coinvolto (URL, passaggi, score)
   - Il gap report del competitor (se disponibile)
3. L'LLM avvia la conversazione con un messaggio iniziale contestualizzato: "Ho analizzato il tuo contenuto X per la query Y. Il tuo competitor Z viene citato perché [gap report]. Ecco come migliorare: [bozza/suggerimento]. Vuoi che adatti qualcosa?"
4. L'utente interagisce in stile chat: chiede modifiche, approfondimenti, varianti
5. La conversazione resta salvata e accessibile dalla lista del GEO Expert

**Architettura tecnica**:

Nuovo modello DB:
```
ExpertConversation
  id              String
  projectId       String
  recommendationId String?    // link alla raccomandazione di origine
  targetQueryId   String?     // query di contesto
  title           String      // auto-generato dal contesto
  contextPayload  Json        // snapshot dei dati iniettati (rec, content, competitor)
  status          String      // 'active' | 'archived'
  createdAt       DateTime
  updatedAt       DateTime

ExpertMessage
  id              String
  conversationId  String
  role            String      // 'user' | 'assistant' | 'system'
  content         String
  createdAt       DateTime
```

**LLM**: Gemini Flash per costo ($0.01-0.05 per conversazione tipica di 5-10 messaggi). Il system prompt include tutti i dati di contesto dalla `contextPayload`. Ogni messaggio utente viene inviato con la history completa (context window management come documentato nella sezione `anthropic_api_in_artifacts`).

**Nota su AD-02**: il GEO Expert NON è scoring. È generazione di contenuti e consulenza — lo stesso use case di `generate_recommendations()` e `generate_insights()` che già usano LLM. AD-02 vieta LLM nello scoring, non nella generazione di contenuti.

**Vincoli**:
- Max conversazioni per progetto: 50 (free) / illimitate (pro)
- Max messaggi per conversazione: 30
- Il GEO Expert non modifica direttamente i contenuti nel DB — produce testo che l'utente copia e applica

---

### 3.4 Costruzione personas

**Decisione**: personas manuali come complemento a quelle auto-generate da GSC. Priorità bassa — da sviluppare dopo tutto il resto.

**Come funzionano le personas manuali — UX semplificata**:

L'utente non deve compilare campi tecnici. Il form chiede 3 cose:

1. **Chi è questa persona?** — campo testo libero, una frase.
   Esempio: "Un SEO manager in agenzia che cerca tool per i suoi clienti"
   Esempio: "Un imprenditore B2B che vuole capire se il suo sito compare nell'AI"

2. **Cosa cerca di solito?** — 2-3 query esempio che questa persona farebbe.
   Esempio: "migliore tool SEO AI", "come monitorare citazioni AI per clienti"

3. **Nome del profilo** — auto-suggerito dal sistema ma editabile.
   Esempio: "SEO Agency Manager"

Il sistema genera automaticamente il `contextPrompt` per la citation check variant a partire da questi input. L'utente non vede e non deve capire il context prompt — è un dettaglio tecnico gestito dal backend.

**Schema**: estendere `IntentProfile` con:
- `source: 'gsc' | 'manual'` (nuovo campo)
- `manualDescription: String?` (il testo "chi è questa persona")
- `manualSampleQueries: String[]?` (le query esempio)

Le personas auto-generate da GSC non sono editabili (vengono rigenerate ad ogni sync). Le manuali restano immutate tra i sync.

**Generazione del contextPrompt per personas manuali**: un singolo LLM call (Gemini Flash) prende la descrizione + sample queries e genera un context prompt di 2-3 frasi. Costo: $0.001 per persona. One-shot, non ripetuto.

---

### 3.5 Simulazione query + analisi competitor dalle citazioni

**Decisione**: approvato + enfasi sul "perché il competitor viene citato".

Per ogni citation check, nella sezione Citation della query:

- **Top 5 competitor citati**: dominio, titolo pagina, posizione nella risposta AI
- Per ogni competitor citato, **gap report accessibile inline**: "Ecco perché example.com è citato e tu no per questa query"
- Il gap report mostra il confronto strutturale: answer capsule, statistiche, entity density, schema, freshness — con i dati specifici del competitor e dell'utente per questa query
- **CTA**: "Migliora con GEO Expert" che avvia una conversazione con il gap report come contesto

I dati per questo esistono già (`competitor_gap_reports` nei metadata dello snapshot + `CompetitorContent` + `CompetitorPassage`). L'implementazione è prevalentemente UI.

**Auto-save competitor**: ogni dominio citato in un citation check che non è il sito dell'utente viene automaticamente aggiunto come `Competitor` con `source: 'citation'`. Questo alimenta la sezione Competitors dentro ogni query.

---

### 3.6 Competitor: ristrutturazione completa (query-centrica)

**Decisione**: la sezione Competitors non è più globale ma vive dentro ogni query. A livello di Overview, si ha una vista aggregata.

#### 3.6.1 Competitors dentro la query

Ogni query ha la sua lista di competitor, derivata dai citation check:

- **Ranking per query**: "Per 'miglior CRM per startup', chi viene citato?" con posizione e frequenza di apparizione
- **Card competitor**: dominio, quante volte citato nelle ultime N settimane (quando lo scheduling è attivo), gap report per questa query
- **Trend**: "example.com è stato citato 8/10 volte per questa query" (richiede scheduling attivo)

#### 3.6.2 Vista aggregata in Overview

L'Overview mostra una sezione "Competitor landscape":

- Top competitor globali (aggregati su tutte le query): "example.com compete con te su 4/5 query"
- Competitor che appaiono in più query vs competitor specializzati (appaiono in una sola)
- Confronto score globale (quando i sub-score competitor saranno implementati)

#### 3.6.3 Schema DB necessario

**Nuova tabella** `CompetitorQueryAppearance`:
```
CompetitorQueryAppearance
  id              String
  competitorId    String
  targetQueryId   String
  citationCheckId String
  position        Int?       // posizione nella risposta AI
  checkedAt       DateTime
```

Questa tabella traccia ogni apparizione di un competitor per una query in uno specifico citation check. È la base per calcolare la frequenza di apparizione nel tempo.

**Estensione** `Competitor`:
- Aggiungere i 5 sub-score (come `ProjectScoreSnapshot`): `citationPowerScore`, `extractabilityScore`, `entityAuthorityScore`, `sourceAuthorityScore`, `fanoutCoverageScore`
- Questi vengono calcolati durante il competitor_pipeline, non solo `avgPassageScore`

**Estensione** `Recommendation`:
- Aggiungere `targetQueryId: String?` per legare ogni raccomandazione alla query di origine
- Questo è il singolo cambio di schema che sblocca il modello query-centrico per le recommendations

#### 3.6.4 Competitor manuali

L'utente può ancora aggiungere competitor manualmente. Questi vengono aggiunti a livello di progetto (non di query) e appaiono in tutte le query come "competitor monitorati". La differenza è che i competitor auto-scoperti vivono nella query specifica dove sono stati citati.

---

### 3.7 Loop continuo — scheduling + modello statistico citazioni

**Decisione**: cronjob su Hetzner. Citation check **giornaliero** + booster prima settimana + stima bayesiana + re-analisi mensile + GSC sync settimanale.

#### 3.7.1 Il problema statistico: perché servono molti check

Ogni citation check è un trial di Bernoulli: citato (1) o non citato (0). Per stimare la probabilità vera *p* di essere citato serve un campione sufficiente. Il margine d'errore al 95% di confidenza è ME = 1.96 × √(p(1-p)/n). Nel caso di massima incertezza (p = 0.5):

| Campione (n) | Margine d'errore | Utilità pratica |
|---|---|---|
| 5 | ±44% | Inutile — non distingui nulla |
| 10 | ±31% | Quasi inutile |
| 20 | ±22% | Mediocre — distingui "quasi mai" da "quasi sempre" |
| 30 | ±18% | Accettabile |
| 50 | ±14% | Buono — puoi fare decisioni |

Con 1 check a settimana servirebbero 7 mesi per 30 check. Il cliente se ne va dopo 2 settimane. Il campionamento deve essere drasticamente più frequente.

#### 3.7.2 Citation check giornaliero

La frequenza di base è **1 check per query per giorno**. Questo produce:

- 7 giorni: 7 check — forma iniziale
- 14 giorni: 14 check — ME ±26%, inizi a distinguere
- 30 giorni: 30 check — ME ±18%, dato su cui ragionare

**Costo a regime**: 15 query × 1 check/giorno × 30 giorni = 450 check/mese. A $0.03/check = ~$13.50/mese per progetto. A $0.01/check = ~$4.50/mese. Per un SaaS che costa €49-199/mese, perfettamente sostenibile.

**Implementazione**: un cron giornaliero su Hetzner (es. 03:00 UTC) enumera i progetti attivi e crea un job `scheduled_citation_daily` per ciascuno. Il job esegue un check per ogni query target attiva del progetto.

#### 3.7.3 Booster mode (prima settimana)

Quando un progetto completa la prima analisi, il sistema lancia **3 check al giorno per 7 giorni**:

- Prima settimana: 3 check/giorno × 7 giorni = **21 check per query**
- ME con 21 check: ±21% — non perfetto ma il cliente vede una tendenza reale e può distinguere "quasi sempre citato" da "quasi mai citato"

Dopo il booster, si passa a 1 check/giorno (regime).

**Costo booster**: 15 query × 3 check/giorno × 7 giorni = 315 check. A $0.03 = ~$9.45 una tantum per progetto. Sostenibile come costo di acquisizione.

**Perché 3 check al giorno e non 1**: i 3 check giornalieri catturano la **varianza di sessione** (intra-day) — stessa query, stesso giorno, risultati diversi per stocasticità dell'LLM. Se 3 check nello stesso giorno danno 3/3 citato, il segnale è forte. Se danno 1/3, il brand è borderline per quella query. Questo dato di varianza intra-day è informazione preziosa che un singolo check al giorno non cattura.

**Implementazione**: quando il primo job `full_analysis` completa con successo, il worker crea automaticamente job `scheduled_citation_burst` per i successivi 7 giorni (3 check/giorno). Il campo `scheduledAt` (nuovo nel modello `Job`) indica quando il worker deve processarli. Dopo i 7 giorni, il cron giornaliero prende il controllo con 1 check/giorno.

**Schema Job**: aggiungere `scheduledAt: DateTime?` al modello `Job`. Il worker ignora i job con `scheduledAt` nel futuro.

#### 3.7.4 Modello bayesiano Beta-Binomiale

Il conteggio frequentista ("citato X su Y volte") non comunica l'incertezza. Usiamo un modello **Beta-Binomiale** che è sia più rigoroso sia più comunicabile.

**Come funziona**:

Ogni query target ha una distribuzione **Beta(α, β)** dove:
- α = numero di check con esito "citato" + 1
- β = numero di check con esito "non citato" + 1
- Prior: Beta(1,1) = distribuzione uniforme (nessuna informazione iniziale)

Dopo ogni check, si aggiorna:
- Citato → α += 1
- Non citato → β += 1

La distribuzione Beta posteriore fornisce:
- **Stima puntuale** (citationRate): α / (α + β)
- **Intervallo credibile al 90%**: `scipy.stats.beta.ppf([0.05, 0.95], α, β)`
- **Larghezza intervallo**: misura diretta dell'incertezza residua

**Esempio concreto**: dopo 21 check (fine booster), di cui 14 citato:
- α = 15, β = 8
- Stima puntuale: 65.2%
- Intervallo 90%: [45.5%, 82.1%]
- Larghezza: 36.6% → label "Stima preliminare"

Dopo 44 check (fine primo mese), di cui 30 citato:
- α = 31, β = 15
- Stima puntuale: 67.4%
- Intervallo 90%: [53.8%, 79.3%]
- Larghezza: 25.5% → label "Confidenza media"

**Dove si calcola**: nel microservizio Python (scipy è già nelle dipendenze). L'endpoint API che restituisce i dati citation per una query calcola α, β, rate, intervallo e label on-the-fly dalla tabella `citation_checks`. Non servono campi pre-calcolati.

**Prior informativo (fase 2, opzionale)**: anziché Beta(1,1), usare l'AI Readiness Score come prior. Un contenuto con score alto parte con un prior più ottimista (es. Beta(3,2)). Accelera la convergenza con meno dati. Nella prima versione, il prior uniforme va bene.

#### 3.7.5 CitationRate — UX

L'utente vede tre elementi per ogni query nella sezione Citation:

**1. Rate con banda di confidenza (visualizzazione)**

Una barra orizzontale con un punto (la stima puntuale) e un'area colorata (l'intervallo credibile):

```
Query: "miglior CRM per startup"

  [░░░░░░░░████████████████░░░░░░░]
  0%       52%     67%    82%     100%
           lower   rate   upper

  Citato 14/21 check · Confidenza: media
```

La barra si restringe man mano che i dati aumentano. L'utente vede fisicamente l'incertezza ridursi nel tempo — questo comunica il valore del monitoraggio continuo senza dover spiegare la statistica.

**2. Label di confidenza testuale**

| Larghezza intervallo | Label | Quando si raggiunge (tipicamente) |
|---|---|---|
| > 40% | "Raccolta dati in corso" | 0-10 check (primi 3-4 giorni) |
| 25-40% | "Stima preliminare" | 10-20 check (fine prima settimana / booster) |
| 15-25% | "Confidenza media" | 20-35 check (2-4 settimane) |
| 10-15% | "Confidenza alta" | 35-50 check (5-7 settimane) |
| < 10% | "Dato affidabile" | 50+ check (2+ mesi) |

Questo risolve il problema iniziale: il cliente vede "Raccolta dati in corso" e capisce che serve tempo. Non pensa che il tool non funziona — vede la barra restringersi attivamente, giorno dopo giorno.

**3. Trend direzionale (dopo 14+ giorni di dati)**

Confronto tra prima e seconda metà delle osservazioni:
- Rate seconda metà > prima metà + 10% → trend in crescita ↑
- Rate seconda metà < prima metà - 10% → trend in discesa ↓
- Differenza ≤ 10% → stabile →

Il trend è il dato più azionabile. "Stai migliorando" o "Stai peggiorando" è più utile del rate assoluto.

**4. Stabilità della citazione (segnale bonus dal booster)**

Se ci sono check multipli nello stesso giorno (booster mode), calcolare la varianza intra-day. Comunicata come:
- **Alta stabilità**: risultati consistenti tra sessioni dello stesso giorno (es. 3/3 o 0/3 nella maggior parte dei giorni)
- **Bassa stabilità**: risultati misti nello stesso giorno (es. 1/3 o 2/3 frequente) → il brand è borderline per questa query

Questo dato appare come un badge accanto al rate: "Stabilità: alta" / "Stabilità: media" / "Stabilità: bassa". È un segnale che nessun competitor misura.

#### 3.7.6 Re-analisi mensile

Il full scoring pipeline viene rieseguito mensilmente per i progetti attivi. Cattura: contenuti aggiornati, nuovi competitor, cambiamenti nella copertura. Crea un nuovo `ProjectScoreSnapshot`.

**Implementazione**: cron mensile (es. primo lunedì del mese) che crea job `scheduled_analysis` per ogni progetto attivo.

#### 3.7.7 GSC sync settimanale

Se GSC è collegato, sync automatico settimanale. Aggiorna suggerimenti query, profili audience, dati traffico.

**Implementazione**: cron settimanale (es. domenica notte) che crea job `scheduled_gsc_sync` per ogni progetto con `gsc_connections.status = 'active'`.

#### 3.7.8 Budget complessivo e scalabilità

**Costo per progetto attivo al mese (a regime)**:

| Componente | Free (3 query) | Pro (10 query) |
|---|---|---|
| Citation giornaliero | 3 × 30 × $0.03 = $2.70 | 10 × 30 × $0.03 = $9.00 |
| Full analysis | ~$0.30 | ~$0.50 |
| GSC sync | ~$0.00 | ~$0.00 |
| **Totale/mese** | **~$3.00** | **~$9.50** |

Con booster (prima settimana, una tantum): +$2.80 (Free) / +$9.45 (Pro).

**Capacità del worker** (Hetzner, singolo processo, ipotizzando mix 70% Free + 30% Pro):

| Progetti attivi | Check giornalieri (media) | Tempo a 30s/check | Fattibile? |
|---|---|---|---|
| 50 | ~255 | ~2 ore | Sì |
| 100 | ~510 | ~4.25 ore | Sì |
| 200 | ~1,020 | ~8.5 ore | Sì (processo notturno) |
| 500 | ~2,550 | ~21 ore | No — serve parallelizzazione |

**Soglia critica**: a ~300 progetti attivi servono worker paralleli. Con asyncio e concurrency limiter (3-5 check in parallelo), la soglia sale a ~800 progetti. Redis + BullMQ oltre i 1.000.

AD-09 resta valido per la prima fase. La rivalutazione avviene a ~300 progetti attivi.

---

## 4. Gestione conflitti cross-query

### 4.1 Il problema

Raccomandazioni per query diverse possono essere contraddittorie sullo stesso contenuto. Esempio: per "cos'è un CRM" → semplifica il linguaggio; per "miglior CRM enterprise" → aggiungi dettaglio tecnico. Entrambe corrette nel contesto, ma incompatibili sullo stesso articolo.

### 4.2 La soluzione: conflict detection nell'Overview

L'Overview include una sezione "Conflitti" che:

1. Per ogni contenuto, raccoglie le raccomandazioni da tutte le query che lo coinvolgono
2. Identifica raccomandazioni potenzialmente contraddittorie (stesse dimensioni con direzioni opposte)
3. Propone la risoluzione: "Questo articolo serve 3 query con esigenze diverse. Considera di dividerlo in contenuti separati." Oppure: "Le raccomandazioni per le query A e B su questo contenuto sono in conflitto. Prioritizza la query con impatto maggiore."

**Implementazione**: la detection è euristica. Due raccomandazioni sono "in conflitto" se:
- Riguardano lo stesso `contentId`
- Hanno `targetScore` uguali (stessa dimensione) 
- Ma direzioni opposte nel `suggestedAction` (es. "semplifica" vs "approfondisci")

Nella prima versione, basta flaggare i contenuti che ricevono raccomandazioni da 3+ query diverse — statisticamente, più query servono più è probabile il conflitto. L'utente viene guidato a controllare.

---

## 5. Impatto complessivo sullo schema DB

### 5.1 Nuove tabelle

| Tabella | Scopo |
|---|---|
| `ExpertConversation` | Thread di conversazione GEO Expert |
| `ExpertMessage` | Messaggi singoli nelle conversazioni |
| `CompetitorQueryAppearance` | Apparizioni competitor per query nel tempo |

### 5.2 Campi nuovi su tabelle esistenti

| Tabella | Campo | Tipo | Scopo |
|---|---|---|---|
| `Content` | `detectedLanguage` | `String?` | Lingua rilevata dal contenuto |
| `Content` | `source` | estendere con `'sitemap'` | Nuovo valore per import da sitemap |
| `Recommendation` | `targetQueryId` | `String?` | Legame query-centrico |
| `IntentProfile` | `source` | `String` (`'gsc'` o `'manual'`) | Origine del profilo |
| `IntentProfile` | `manualDescription` | `String?` | Descrizione persona manuale |
| `IntentProfile` | `manualSampleQueries` | `String[]?` | Query esempio |
| `Job` | `scheduledAt` | `DateTime?` | Per scheduling futuro (booster + cron) |
| `Competitor` | 5 sub-score fields | `Float?` | Score strutturati come ProjectScoreSnapshot |

### 5.3 Nuovi job types

| Tipo | Trigger | Scopo |
|---|---|---|
| `sitemap_import` | Manuale (utente clicca "Importa da sitemap") | Scarica sitemap, estrae URL, crea contenuti |
| `expert_chat` | Manuale (utente invia messaggio) | Chiama LLM con contesto, salva risposta |
| `scheduled_citation_daily` | Cron giornaliero (03:00 UTC) | 1 citation check per query per progetto attivo |
| `scheduled_citation_burst` | Auto-creato dopo prima `full_analysis` | 3 check/giorno × 7 giorni (booster mode) |
| `scheduled_analysis` | Cron mensile (1° lunedì del mese) | Re-analisi full pipeline per progetto attivo |
| `scheduled_gsc_sync` | Cron settimanale (domenica notte) | Sync GSC automatico per progetti con GSC attivo |

---

## 6. Priorità di implementazione (riviste)

### Fase 0 — Infrastruttura e staging (`dev.visiblee.ai`)

Prerequisito per tutto il resto. Lo scheduling, il flusso OAuth GSC, le email, e il cron hanno bisogno di un ambiente reale per essere testati. L'architettura staging replica la produzione: Vercel per il frontend, Hetzner per DB + Python (coerente con AD-01).

0.1. **Database staging**: creare database `visiblee_dev` sullo stesso server PostgreSQL Hetzner. Stesso server, database separato — nessun costo aggiuntivo.

0.2. **Deploy Next.js su Vercel (branch `dev`)**: creare un secondo progetto Vercel (o usare preview deployments) puntato al branch `dev`. Dominio: `dev.visiblee.ai`. Environment variables di staging separate (puntano a `visiblee_dev`, API URL staging). Vercel gestisce SSL, CDN, e deploy automatico su push.

0.3. **Separare il worker da FastAPI**: oggi il worker è un background task dentro il lifespan di FastAPI — se FastAPI crasha, il worker muore. Estrarre il worker come processo separato (`python -m app.worker`) gestito da Ploi/supervisor con auto-restart. FastAPI diventa solo endpoint HTTP per health check e test.

0.4. **Setup cron via Ploi**: creare `services/analyzer/app/scheduler.py` — script che si connette al DB e crea i job schedulati. Il cron non esegue nulla di pesante: solo INSERT nella tabella `jobs`. Configurare in Ploi come cron job (giornaliero 03:00 UTC). Per ora lo script è vuoto/placeholder — la logica viene implementata in Fase A.

0.5. **Configurazione ambiente**: `.env` staging sul server Python con tutte le API key (Gemini, Voyage, Brave, MailerSend), `ANALYZER_API_URL` puntato al server Hetzner. Su Vercel: environment variables staging con `AUTH_URL=https://dev.visiblee.ai`, `DATABASE_URL` che punta a `visiblee_dev`. Redirect URI OAuth Google per GSC aggiunto su Google Cloud Console per il dominio staging.

0.6. **Smoke test**: deploy completo, verifica che il flusso end-to-end funzioni su `dev.visiblee.ai` (registrazione → creazione progetto → discovery → analisi → citation check). Tutto su dati reali.

**Criterio di completamento**: `dev.visiblee.ai` è raggiungibile su Vercel, il worker gira come daemon separato su Hetzner, il cron è configurato (anche se ancora vuoto), il flusso OAuth GSC funziona con il dominio staging.

### Fase A — Fondamenta del loop continuo
1. **Scheduling logic in `scheduler.py`**: campo `scheduledAt` su Job, logica cron per creare `scheduled_citation_daily` + `scheduled_citation_burst` + `scheduled_gsc_sync` + `scheduled_analysis`
2. **Booster mode**: auto-creazione 3 check/giorno × 7 giorni dopo prima `full_analysis`
3. **Modello bayesiano**: calcolo Beta(α, β) on-the-fly nel Python, endpoint API che restituisce rate + intervallo + label + stabilità
4. **CitationRate UX**: barra con banda di confidenza, label testuale, trend direzionale, badge stabilità

### Fase B — Navigazione query-centrica
5. **Restructure routing**: da pagine globali a sotto-pagine per query (coverage, citation, competitors, recs)
6. **Recommendation con `targetQueryId`**: migration + aggiornamento pipeline per legare recs alla query
7. **Competitor auto-discovery**: `CompetitorQueryAppearance` + auto-save dai citation check
8. **Overview come aggregator**: conflict detection, competitor landscape, KPI globali

### Fase C — Miglioramento setup
9. **Sitemap import**: job + UI
10. **Confidence visibile**: badge + filtri nella content review
11. **GSC nell'onboarding**: ristrutturare wizard di creazione progetto
12. **Onboarding pervasivo**: `SetupChecklist` su tutte le pagine + Overview wizard

### Fase D — GEO Expert
13. **Schema**: `ExpertConversation` + `ExpertMessage`
14. **Backend**: endpoint chat con context injection, LLM call (Gemini Flash)
15. **UI**: sezione lista conversazioni + chat view + CTA nelle recommendations
16. **Context enrichment**: gap report, content data, competitor data iniettati nel system prompt

### Fase E — Personas manuali (bassa priorità)
17. **Schema**: nuovi campi su `IntentProfile`
18. **UI**: form semplificato (3 campi)
19. **Backend**: generazione `contextPrompt` da input manuali

---

## 7. Vincoli non negoziabili (invariati)

- **Scoring euristico, zero LLM** (AD-02) — si applica allo scoring, non alla generazione di contenuti
- **Classificazione intent GSC euristica** (AD-15)
- **Citation check solo via Gemini Grounding** (AD-03)
- **Pipeline Python su FastAPI separato** (AD-01)
- **Job asincroni via DB polling** (AD-09) — da rivalutare a ~300 progetti attivi
- **i18n senza URL prefix**
- **No scraping ChatGPT/Perplexity**
- **Token OAuth cifrati AES-256-GCM** (AD-14)

---

## 8. Pricing e limiti per piano

### 8.1 Filosofia

Il tool è nuovo. L'argomento è fresco. L'utente non sa ancora cosa sta comprando. In questo contesto, mille vincoli spaventano. Il pricing deve essere semplice: pochi limiti chiari, esperienza il più libera possibile, e l'upgrade si giustifica da solo quando l'utente ha bisogno di più spazio.

Struttura: **Free / Pro (€99/mese) / Enterprise (Contact us)**.

### 8.2 Analisi costi per piano

Costi variabili mensili per progetto attivo (base: Gemini Grounding a $0.03/check). Entrambi i piani hanno la stessa frequenza di aggiornamento — il Free non è degradato.

| Voce | Free (3 query) | Pro (10 query) |
|---|---|---|
| Citation giornaliero + booster | 3 × 30 × $0.03 = $2.70 + booster ~$2.80 | 10 × 30 × $0.03 = $9.00 + booster ~$9.45 |
| Full analysis mensile | ~$0.30 | ~$0.50 |
| GSC sync settimanale | $0.00 | $0.00 |
| **Totale/mese/progetto (a regime)** | **~$3.00** | **~$9.50** |

Free con 1 progetto: ~$3.00/mese non ripagato. Sostenibile come costo di acquisizione.
Pro con 3 progetti: ~$28.50/mese di costo variabile. A €99/mese, margine ~70%. Molto sano.

### 8.3 Piano Free — "Prova tutto, con un solo brand"

L'utente Free ha accesso a tutte le funzionalità core. Nessuna feature è nascosta o degradata. L'unica differenza: opera su scala ridotta (1 progetto, 3 query) e non ha accesso al GEO Expert.

| Dimensione | Limite | Note |
|---|---|---|
| Progetti attivi | **1** | Può archiviarne 1 e crearne un altro |
| Query target | **3** | Sufficienti per capire il meccanismo |
| Contenuti monitorati | **Illimitati** | Più ne inserisce, più il tool è utile — nessun motivo di limitare |
| Citation check | **Giornaliero + booster** | Stessa frequenza del Pro. L'utente deve percepire il valore reale |
| Re-analisi | **Automatica mensile** | Stesso trattamento del Pro |
| Storico dati | **60 giorni** | ~2 mesi di trend. Sufficiente per capire la direzione |
| GSC | **Completo** | Collegamento, suggerimenti, sync automatico, audience enrichment |
| Audience/Personas | **Completo** (auto + manuali) | Nessuna limitazione |
| Competitor | **Auto-discovered illimitati** | Vede tutti i competitor emersi dalle citazioni |
| Competitor manuali | **No** | |
| Sitemap import | **No** | |
| GEO Expert | **No** | Vede le raccomandazioni ma non può azionarle con l'assistente |
| Notifiche email | **No** | Solo in-app |
| Export CSV | **No** | |

**Cosa guida l'upgrade**: non è la frustrazione dei limiti ma la naturale crescita del bisogno. L'utente con 3 query capisce che ne servono 10. L'utente con 1 progetto vuole monitorare un secondo brand. L'utente che vede raccomandazioni precise vuole il GEO Expert per metterle a terra. E dopo 60 giorni, vuole 180 giorni di storico per vedere il trend lungo.

### 8.4 Piano Pro — €99/mese

Monitoraggio completo per chi vuole competere seriamente nell'AI search.

| Dimensione | Limite | Note |
|---|---|---|
| Progetti attivi | **3** | Brand principale + 2 sotto-brand o clienti |
| Progetti archiviati | **Illimitati** | |
| Query target per progetto | **10** | Lascia headroom per Agency (fino a 15 da AD-11) |
| Contenuti monitorati | **Illimitati** | |
| Citation check | **Giornaliero + booster** | |
| Re-analisi | **Automatica mensile** | |
| Storico dati | **180 giorni** | ~6 mesi di trend |
| GSC | **Completo** | |
| Audience/Personas | **Completo** (auto + manuali, max 5 manuali per progetto) | |
| Competitor | **Auto-discovered illimitati + 5 manuali** per progetto | |
| Sitemap import | **Sì** | |
| GEO Expert | **30 conversazioni attive** per progetto | |
| Notifiche email | **Sì** (analisi completata, score cambiato, nuovo competitor) | |
| Export CSV | **Sì** | |

**Perché €99/mese**: posiziona il tool come strumento professionale, non come gadget. Il costo variabile (~$28.50 per 3 progetti) lascia un margine ~70%. È un prezzo che un freelance o un piccolo team può giustificare come spesa di business, e che un'agenzia considera economico per quello che fa.

**Perché 10 query e non 15**: 15 è il limite computazionale (AD-11), ma tenerlo come headroom per Agency crea il ponte naturale. Chi ha bisogno di 15 query per progetto probabilmente gestisce più clienti → Contact us.

**Perché 3 progetti**: copre "il mio brand + 2 clienti" o "brand + blog + side project". Chi ha 5+ è un'agenzia.

### 8.5 Piano Enterprise / Agency — "Contact us"

In landing page, sotto il Pro: "Gestisci più di 3 brand? Parla con noi." con form di contatto.

Pricing custom basato su:
- Numero di progetti (fino a illimitati)
- Query per progetto (fino a 15, come da AD-11)
- Frequenza citation check (3/giorno permanente per stabilità intra-day)
- White-label / rimozione branding
- Multi-user per progetto / team
- API access
- SLA e supporto dedicato

### 8.6 Trigger di upgrade Free → Pro

I momenti naturali in cui il Free spinge verso il Pro:

1. **Aggiunge la 4a query** → "Hai raggiunto il limite di 3 query. Passa a Pro per monitorarne fino a 10."
2. **Clicca "Ottimizza con GEO Expert"** → "Il GEO Expert è disponibile con Pro. Aziona i suggerimenti con l'assistente AI."
3. **Prova ad aggiungere un secondo progetto** → "Archivia il progetto attivo oppure passa a Pro per gestirne fino a 3."
4. **Storico 60 giorni scade** → "I dati oltre i 60 giorni vengono rimossi. Con Pro, mantieni 6 mesi di storico."
5. **Prova a esportare** → "L'export CSV è disponibile con Pro."
6. **Prova ad aggiungere un competitor manuale** → "L'aggiunta manuale di competitor è disponibile con Pro."

Ogni trigger mostra un banner non invasivo con CTA. Non bloccare mai l'utente — mostra cosa guadagnerebbe.

### 8.7 Implementazione tecnica

**Backend enforcement** (microservizio Python + API Routes Next.js):
- Controllare il piano prima di creare query, progetti, conversazioni GEO Expert
- Il piano è un campo `plan: 'free' | 'pro' | 'enterprise'` sul modello `User`
- I limiti sono in un file di configurazione centralizzato (`plan-limits.ts` + `config.py`), non sparsi nel codice
- Lo scheduling (cron giornaliero) tratta tutti i progetti allo stesso modo — nessuna logica di piano nel worker

**UI feedback**:
- Badge "Pro" accanto alle feature bloccate (GEO Expert, export, sitemap, competitor manuali)
- Feature bloccate visibili ma non azionabili (lock icon + CTA upgrade)
- Mai nascondere una feature — mostrare sempre cosa l'utente guadagnerebbe con l'upgrade
- Counter visibile: "3/3 query usate" con CTA inline quando il limite è raggiunto

**Billing**: prima fase gestione manuale (il founder attiva/disattiva i piani da admin). Integrazione Stripe nella fase successiva. Il campo `plan` sul `User` è sufficiente per iniziare.

**Data retention**: un cron settimanale elimina i `CitationCheck` e i `ProjectScoreSnapshot` oltre la finestra di storico del piano (60gg Free, 180gg Pro). I dati raw (`Content`, `Passage`) non vengono mai eliminati — solo le analisi storiche.

---

## 9. Domande aperte per le prossime sessioni

1. **Competitor sub-score**: implementare nel competitor_pipeline esistente o in un pipeline separato?
2. **Conflict detection**: quanta sofisticazione nella prima versione? Bastano le euristiche semplici?
3. **GEO Expert LLM**: Gemini Flash (economico) o Claude (migliore qualità per contenuti lunghi)?
4. **Parallelizzazione worker**: a ~150 progetti attivi servono worker paralleli. asyncio con concurrency limiter come prima misura, o direttamente Redis + BullMQ?
5. **Prior informativo (fase 2)**: usare l'AI Readiness Score come prior Beta per accelerare la convergenza del citationRate?
6. **Billing integration**: Stripe subito o gestione manuale nella prima fase?
7. **Pricing annuale**: offrire uno sconto per il pagamento annuale (es. €79/mese annuale vs €99/mese mensile)?
8. **Trial Pro**: offrire 14 giorni di Pro trial al signup? Pro: l'utente vede tutto subito. Contro: il downgrade dopo 14 giorni è frustrante.
