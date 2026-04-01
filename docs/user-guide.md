# Guida Utente — Come funziona Visiblee

> **Data**: Aprile 2026
> **Lingua**: Italiano
> **Audience**: marketer, professionisti SEO, brand manager, consulenti GEO

---

## 1. Cos'è Visiblee e cosa misura

Visiblee misura e migliora la visibilità del tuo brand in Google AI Mode e Google AI Overviews.

Questi sistemi non funzionano come la SEO tradizionale. Non mostrano una lista di link — generano una risposta sintetica e citano alcune fonti. Il problema: l'88% delle pagine citate da AI Mode non appare nemmeno nella top 10 organica di Google. Essere in prima posizione su Google non garantisce più di essere citato dall'AI.

Visiblee analizza i tuoi contenuti e risponde a tre domande:

1. **Quanto sei "citabile"?** — L'AI Readiness Score misura la probabilità che i tuoi contenuti vengano scelti e citati.
2. **Per quali domande sei coperto?** — L'Opportunity Map mostra esattamente dove hai copertura e dove hai gap.
3. **Perché i tuoi competitor vengono citati al posto tuo?** — Il Competitor Analysis fa un reverse engineering strutturale delle pagine dei competitor che l'AI cita.

---

## 2. Configurazione iniziale del progetto

### 2.1 Cosa inserire al momento della creazione

Quando crei un nuovo progetto, ti vengono chiesti:

- **Nome del brand**: il nome ufficiale del tuo brand o azienda, esattamente come appare online (es. "Salesforce", "Fatture in Cloud", "Marco Rossi Consulting").
- **Nome del progetto**: un nome interno per riconoscere il progetto nella dashboard — può essere lo stesso del brand o una variante operativa.
- **URL del sito web**: l'URL principale del tuo sito (es. `https://tuodominio.it`). Questo è il punto di partenza per la discovery dei contenuti.
- **Descrizione**: 2-3 frasi che descrivono cosa fai, per chi, e qual è il tuo differenziatore. Viene usata per calibrare la scoperta dei contenuti e la generazione delle query di analisi.

### 2.2 Target language e target country

Questi due parametri sono fondamentali per ottenere risultati rilevanti.

**Target language** (ISO 639-1): la lingua in cui vuoi essere citato nei risultati AI. Se il tuo pubblico principale è italiano, usa `it`. Se vuoi analizzare la visibilità in inglese, usa `en`. Questa scelta determina la lingua delle sotto-query generate dall'AI durante l'analisi — misurare la copertura italiana con query inglesi darebbe risultati sbagliati.

**Target country** (ISO 3166-1 alpha-2): il paese del mercato target. `IT` per l'Italia, `US` per gli Stati Uniti, `DE` per la Germania. Questo parametro influenza le ricerche effettuate durante la discovery e la simulazione della citation verification.

**Come sceglierli**: scegli il mercato principale dove vuoi ottenere visibilità AI. Se sei un'agenzia italiana che lavora solo per clienti italiani, usa `it` + `IT`. Se sei un SaaS B2B che vuole espandersi in Europa, valuta di creare progetti separati per ogni lingua target.

### 2.3 Setup progressivo e banner di avanzamento

Dopo aver creato il progetto, Visiblee guida il setup con una checklist progressiva visibile nella pagina Overview. La checklist mostra i passaggi da completare in ordine:

1. **[Opzionale] Connetti Google Search Console** — se la funzione è abilitata, questo step appare per primo. Connettere GSC permette di ottenere suggerimenti di query basati su dati reali di ricerca. Puoi saltarlo e connetterlo in qualsiasi momento dalla sezione Settings.
2. **Aggiungi query target** — inserisci le domande per cui vuoi apparire nelle risposte AI.
3. **Avvia la content discovery** — trova automaticamente le tue pagine e menzioni.
4. **Conferma i contenuti** — approva i contenuti rilevanti per l'analisi.
5. **Avvia la prima analisi** — calcola il tuo AI Readiness Score.

**Banner di avanzamento**: finché il setup non è completo, un banner color ambra appare in cima a ogni pagina del progetto (Contents, Queries, ecc.) con il progresso corrente (es. "2 di 4 passaggi completati") e un link diretto all'Overview dove si trova la checklist completa. Il banner scompare automaticamente quando tutti i passaggi base sono completati, o può essere chiuso manualmente.

### 2.4 Query target

Le query target sono le domande per cui vuoi apparire nelle risposte AI. Sono il cuore del progetto.

**Cosa sono**: query reali che il tuo cliente ideale potrebbe digitare su Google AI Mode. Non sono keyword SEO — sono domande complete o frasi informative.

**Quante inserirne**: il piano Free prevede fino a 5 query. Inizia con 3-5 query molto specifiche e rilevanti, piuttosto che con 5 query generiche.

**Come sceglierle**:
- Pensa alle domande che i tuoi clienti fanno durante il ciclo di vendita: "qual è il miglior [prodotto] per [caso d'uso]?", "come funziona [processo]?", "differenza tra [opzione A] e [opzione B]"
- Evita query troppo generiche ("marketing digitale") — l'AI citerà Wikipedia. Scegli query dove la tua esperienza specifica è rilevante.
- Includi query comparative se i tuoi competitor sono noti: "alternativa a [competitor] per [caso d'uso]"

**Esempi di query target ben scelte**:
- "come scegliere un CRM per un team commerciale di 10 persone"
- "differenza tra fatturazione elettronica e e-invoicing B2B"
- "come ottimizzare il budget Google Ads per e-commerce"

**Suggerimenti da Google Search Console**: se hai connesso GSC (vedi sezione 11), Visiblee suggerisce automaticamente nuove query target basandosi sulle query reali con cui gli utenti trovano già il tuo sito. Queste compaiono come banner nella sezione Queries.

---

## 3. Scoperta dei contenuti (Discovery)

### 3.1 Come funziona il crawler

Prima di analizzare i tuoi contenuti, Visiblee deve trovarli. La discovery è automatica e usa due tecnologie:

**Brave Search API**: esegue 8 ricerche parallele che combinano il nome del tuo brand, le keyword del tuo settore e le tue query target. Trova tutte le pagine dove il tuo brand ha una presenza online — non solo il tuo sito, ma anche articoli su media di settore, profili su piattaforme, menzioni su Reddit, ecc.

**Gemini Grounding**: per ogni pagina trovata, Gemini classifica se è un contenuto "tuo" (prodotto o controllato dal brand), un "mention" da terzi, o irrilevante. Vengono incluse anche varianti del nome del brand (abbreviazioni, typo comuni, nomi di prodotti correlati).

### 3.2 Import da sitemap

Prima di avviare la discovery automatica, puoi importare contenuti direttamente dalla sitemap del tuo sito. Il pulsante **"Importa da sitemap"** nella sezione Contents:

1. Scarica `sitemap.xml` (o `sitemap_index.xml`) dal tuo dominio
2. Estrae tutti gli URL `<loc>` presenti
3. Filtra gli URL dello stesso dominio, rimuovendo file media (immagini, PDF, CSS, JS, ecc.)
4. Inserisce i contenuti come **già confermati** (`source: sitemap`, `isConfirmed: true`) — non richiedono revisione manuale

Questo è il modo più veloce per portare dentro tutti i tuoi contenuti propri senza dover aspettare la discovery o confermare pagina per pagina. Un banner blu appare durante l'import; al termine, la lista si aggiorna automaticamente.

### 3.3 Come interpretare i risultati della discovery

Dopo la discovery automatica, vedi una lista di URL trovati con:
- **Tipo**: "own" (contenuto tuo), "mention" (terzi che parlano di te), "review platform", ecc.
- **URL e titolo**: la pagina trovata
- **Piattaforma**: sito web, YouTube, LinkedIn, Reddit, media, ecc.

È normale che la discovery trovi 20-50+ pagine. Non tutte sono utili per l'analisi.

**Badge di attendibilità**: ogni contenuto non ancora confermato mostra un badge colorato che indica quanto Gemini è sicuro della classificazione:
- 🟢 **Alta attendibilità** (≥ 70%): la classificazione è affidabile — procedi con fiducia
- 🟡 **Media attendibilità** (40-69%): ricontrolla l'URL prima di confermare
- 🔴 **Bassa attendibilità** (< 40%): dubbio significativo, verifica manualmente

Il pulsante **"Solo bassa attendibilità"** nel toolbar filtra rapidamente i contenuti più incerti per una pulizia veloce.

**Badge lingua**: se Visiblee rileva che la lingua del contenuto è diversa dalla lingua target del progetto, compare un badge viola (es. `EN — lingua diversa dal target`). Questi contenuti potrebbero distorcere l'analisi se il tuo pubblico è monolingue.

### 3.4 Confermare vs scartare i contenuti

Prima di procedere all'analisi, devi approvare i contenuti che vuoi includere. Questo passaggio è importante:

**Conferma** i contenuti:
- Che sono effettivamente tuoi (scritti da te, con il tuo brand)
- Che sono rilevanti per le tue query target
- Che sono di qualità sufficiente (non landing page obsolete o pagine in costruzione)

**Scarta** i contenuti:
- Mention da terzi (a meno che non siano molto rilevanti)
- Pagine obsolete o deprecate
- Contenuti in lingue diverse dal target language (indicati dal badge viola)
- Pagine duplicate o molto simili ad altre già confermate

**Regola pratica**: è meglio avere 5-10 contenuti di qualità confermati che 30 contenuti eterogenei. L'analisi è più precisa e le raccomandazioni sono più azionabili.

---

## 4. Analisi completa (Full Analysis)

### 4.1 Cosa fa il sistema

Dopo che hai confermato i contenuti, puoi avviare l'analisi completa. Il sistema:

1. **Fetcha ogni pagina confermata**: scarica l'HTML completo, incluse struttura dei tag, schema markup JSON-LD, robots.txt del dominio.
2. **Segmenta in passaggi**: divide ogni pagina in blocchi di testo di 100-250 parole, preservando la posizione relativa nel documento (primo 30%, centro, finale) e calcolando metriche per ogni passaggio (densità di entità, presenza di statistiche, ecc.).
3. **Genera il fan-out**: per ogni tua query target, Gemini genera 10 sotto-query in 6 categorie (correlate, implicite, comparative, esplorative, decisionali, recenti).
4. **Calcola la copertura**: ogni sotto-query viene confrontata con i tuoi passaggi tramite embedding semantico (Voyage AI). Viene calcolata la cosine similarity e assegnata una fascia di copertura.
5. **Calcola i 5 score**: Citation Power, Brand Authority, Extractability, Source Authority vengono calcolati euristicamente sui tuoi passaggi e contenuti.
6. **Calcola il composite**: AI Readiness Score = media pesata dei 5 score × moltiplicatore freshness.

### 4.2 Quanto ci vuole

L'analisi completa richiede tipicamente 3-8 minuti, a seconda del numero di contenuti confermati. Un loader mostra i passaggi in tempo reale:
- Fetching dei contenuti
- Segmentazione e estrazione metriche
- Generazione query fan-out
- Calcolo embeddings
- Scoring
- Salvataggio risultati

### 4.3 Cosa ottieni

Al termine dell'analisi hai accesso a:
- **Overview**: AI Readiness Score + 5 sub-score + grafici
- **Opportunity Map**: copertura per query (verde/giallo/rosso)
- **Content Detail**: passaggi di ogni pagina con i loro score e sub-criteri
- **Recommendations**: azioni prioritarie generate automaticamente

---

## 5. Leggere i risultati

### 5.1 Overview: AI Readiness Score, sub-score e widget aggregati

L'**AI Readiness Score** (0-100) è il numero principale. Interpretazione:

| Range | Significato |
|---|---|
| 0–25 | Il brand è quasi invisibile per i motori AI |
| 26–50 | Presenza parziale, molti gap critici |
| 51–70 | Competitivo su alcune query, ampi margini di miglioramento |
| 71–85 | Buona visibilità AI, lavoro di ottimizzazione fine |
| 86–100 | Tra i più citabili nel proprio settore |

I **5 sub-score** mostrano dove sono i punti di forza e i punti deboli:

| Sub-score | Cosa misura | Peso |
|---|---|---|
| **Query Reach** | Copertura semantica delle sotto-query fan-out | 30% |
| **Citation Power** | Qualità strutturale dei passaggi per la citazione | 25% |
| **Brand Authority** | Riconoscimento del brand nei Knowledge Graph e sul web | 20% |
| **Extractability** | Struttura tecnica che facilita l'estrazione AI | 15% |
| **Source Authority** | Presenza su piattaforme rilevanti per AI | 10% |

Il **moltiplicatore freshness** è visibile separatamente: mostra se i tuoi contenuti sono abbastanza recenti. Un contenuto aggiornato più di 120 giorni fa abbassa il composite score del 30%.

**Widget aggregati nell'Overview** (in fondo alla pagina, quando ci sono dati):

- **Top Competitors**: i domini che compaiono più frequentemente nelle risposte AI per le tue query, aggregati su tutto il progetto. Utile per capire chi è il vero competitor trasversale, non solo su una singola query.
- **Citation Gaps**: le query in cui l'ultimo check non ha rilevato una citazione. Cliccando su una query si arriva direttamente alla sua pagina Citations per avviare un nuovo check.

### 5.2 Score history chart

Ogni volta che esegui un'analisi, il risultato viene salvato e aggiunto al grafico storico. Il trend nel tempo è il KPI più importante: uno score in crescita costante indica che le ottimizzazioni funzionano. Non preoccuparti di piccole oscillazioni tra un'analisi e l'altra — le citazioni AI sono per natura probabilistiche.

### 5.3 Opportunity Map

L'Opportunity Map mostra, per ciascuna delle tue query target, quali sotto-query fan-out sono coperte e quali no.

| Colore | Significato | Azione |
|---|---|---|
| Verde (copertura eccellente) | Il tuo contenuto risponde direttamente a questa sotto-query | Mantieni e monitora |
| Giallo (copertura buona/debole) | Rilevante ma non ottimale | Quick win: migliora il passaggio esistente |
| Rosso (non coperta) | Nessun contenuto risponde a questa sotto-query | Crea un nuovo contenuto o sezione |

Le query gialle sono le **quick win**: hai già un contenuto rilevante, ma non è ottimizzato. Spesso basta aggiungere un answer capsule o una statistica con fonte per passare da "debole" a "eccellente".

### 5.4 Content Detail

Nella sezione Contenuti, puoi cliccare su ogni pagina per vedere l'analisi a livello di passaggio. Per ogni passaggio vedi:
- **Citation Power score** (0-100) del passaggio
- I 6 sub-criteri: position score, entity density, statistical specificity, definiteness, answer-first, source citation
- Un'analisi testuale che spiega cosa manca

Questo è il livello più operativo: sai esattamente quale paragrafo modificare e in che modo.

---

## 6. Navigazione query-centrica

Ogni query target ha ora la sua area dedicata: clicca su una query nella lista per aprirla. Trovi 4 sotto-sezioni accessibili dai tab in cima alla pagina.

### 6.1 Coverage (tab)

La Coverage map filtrata sulla query selezionata. Mostra le sotto-query fan-out generate per questa specifica query e il loro stato di copertura. Identico all'Opportunity Map globale, ma scoped — vedi solo i gap rilevanti per questa query.

### 6.2 Citations (tab)

La pagina principale per monitorare la citazione di questa query. Contiene:
- **Stato citazione**: citato o non citato nell'ultimo check, con posizione e segmento di contenuto supportato
- **Fonti citate**: i domini nella risposta AI di Google
- **Sotto-query interne di Gemini**: le ricerche fan-out che Gemini ha eseguito internamente
- **Varianti per profilo audience** (se GSC connesso)
- **Citation Rate bar** (vedi sezione 6.5)
- **Bottone "Run check"**: avvia un nuovo citation check manuale per questa query

### 6.3 Competitors (tab)

Lista dei competitor rilevati nelle citation per questa specifica query. Ogni competitor mostra:
- Posizione media nella risposta AI
- Numero di volte che è apparso nei check storici

### 6.4 Recommendations (tab)

Le raccomandazioni di ottimizzazione contestualizzate per questa query. Filtrate per rilevanza — vedi solo i suggerimenti generati con il contesto di questa query.

---

## 7. Citation Simulation e Citation Rate

### 7.1 Come funziona

La Citation Simulation risponde alla domanda: "se qualcuno cerca [mia query target] su Google AI Mode, vengo citato?"

Il sistema usa la Gemini API con Google Search Grounding: invia la tua query a Gemini con ricerca web reale attivata, raccoglie le fonti citate nella risposta, e verifica se tra queste fonti compare il tuo sito.

### 7.2 Come leggere i trend

Per ogni query target vedi:
- **Badge "Citato" / "Non citato"**: il risultato dell'ultima simulazione
- **Posizione**: se citato, in quale posizione tra le fonti (posizione 1 = citato per primo)
- **Trend storico**: "Citato 2/4 settimane" — stai costruendo una presenza stabile o stai apparendo in modo casuale?
- **Fonti citate**: i domini che Google ha usato per rispondere (i tuoi competitor diretti per quella query)
- **Sotto-query interne**: le ricerche che Gemini ha fatto internamente per rispondere (il fan-out reale)

### 7.3 Citation per profilo audience (se GSC connesso)

Se hai connesso Google Search Console e Visiblee ha generato profili audience, sotto ogni risultato di citation trovi il **pannello varianti**: mostra come cambia la citation in base al profilo di chi cerca.

Esempio:
```
✓ Citato per "Evaluator"     — posizione 1
✗ Non citato per "Researcher"
✓ Citato per "AI Explorer"   — posizione 3
```

Questo rivela un dato cruciale: potresti essere citato in modo eccellente per gli utenti in fase di valutazione, ma completamente assente per chi cerca informazioni più approfondite. Ogni profilo usa un system prompt diverso che simula il contesto e le aspettative di quell'audience.

### 7.4 Citation Rate — stima bayesiana

Sotto ogni risultato di citazione trovi la **Citation Rate bar**: una barra orizzontale che mostra la probabilità stimata di essere citato per questa query, con la banda di incertezza.

**Come leggerla**:
- Il **punto centrale** è la stima puntuale (es. 67%)
- La **banda colorata** è l'intervallo di confidenza al 95% — più è stretta, più il dato è affidabile
- La **label** indica il livello di confidenza attuale:

| Label | Quando appare | Significato |
|---|---|---|
| Stabile | Tanti check, banda stretta | Dato affidabile, puoi prendere decisioni |
| In apprendimento | Check sufficienti, banda media | Tendenza chiara, ma ancora in raccolta |
| Incerto | Pochi check, banda ampia | Troppo presto per conclusioni |

- La **freccia trend**: indica se il rate sta crescendo (↑), calando (↓) o stabile (→) rispetto alle ultime 2 settimane

**Perché la barra si restringe nel tempo**: ogni citation check aggiunge un dato (citato = 1, non citato = 0). Più dati accumuli, minore è l'incertezza. Il sistema esegue check automatici giornalieri — la barra si restringe da sola senza che tu debba fare nulla.

### 7.5 Monitoraggio automatico

Il sistema esegue citation check automatici:
- **1 check al giorno** per ogni query attiva (a regime)
- **3 check al giorno per 7 giorni** subito dopo la prima analisi completa (booster mode) — cattura la varianza intra-day e accelera la raccolta dati
- **Analisi completa mensile** — aggiorna i sub-score con i nuovi contenuti
- **Sync GSC settimanale** (se connesso) — aggiorna i profili audience

Non devi ricordarti di tornare. I dati crescono automaticamente.

### 7.6 Cosa fare con i dati

**Se sei citato in modo stabile** (3-4 settimane su 4): ottimo. Monitora che non scenda. Usa i dati del competitor analysis per capire cosa ha chi ti supera in posizione.

**Se sei citato in modo instabile** (1-2 settimane su 4): i tuoi contenuti sono borderline. Spesso basta aggiornare la data del contenuto (contenuti freschi hanno un boost) o aggiungere uno-due answer capsule.

**Se non sei mai citato**: vai all'Opportunity Map per quella query e identifica le sotto-query non coperte. Quelle sono le lacune strutturali che impediscono la citazione.

---

## 8. Competitor monitoring

### 8.1 Aggiungere competitor

Nella sezione Competitors puoi aggiungere i tuoi principali competitor. Visiblee li trova anche automaticamente durante la citation simulation: ogni fonte citata da Google per le tue query target che non appartiene al tuo sito viene tracciata come potenziale competitor.

### 8.2 Run analysis

Puoi avviare un'analisi del competitor in qualsiasi momento. Il sistema:
1. Fa fetch della pagina citata del competitor
2. La analizza con la stessa pipeline dei tuoi contenuti
3. Produce un Gap Report strutturale

### 8.3 Confronto score e Gap Report

Per ogni competitor citato al posto tuo, vedi il Gap Report:

```
COMPETITOR: competitor.com — citato per "tua query target"

Perché viene citato:
• Answer capsule presente (42 parole dopo H2)       Tu: No
• Statistiche con fonte: 3                          Tu: 0
• Entity density: 21.8%                             Tu: 7.2%
• Schema Article con author: Sì                    Tu: No
• Aggiornato: 12 giorni fa                          Tu: 97 giorni fa

Azioni prioritarie:
1. Aggiungi un answer capsule dopo il tuo H2 principale
2. Inserisci 2-3 statistiche con attribuzione a fonte
3. Aggiungi schema Article con author e dateModified
4. Aggiorna il contenuto (è oltre i 60 giorni critici)
```

Questo è il dato più azionabile che Visiblee produce: non "il tuo score è basso", ma "fai queste 4 cose specifiche per competere con chi viene citato al posto tuo".

---

## 9. Optimization & Recommendations

### 9.1 Come usare i consigli generati

La sezione Optimization mostra raccomandazioni prioritarie generate dal sistema basandosi sui risultati dell'analisi. Le raccomandazioni sono:

- **Specifiche**: non "migliora i tuoi contenuti" ma "aggiungi un answer capsule di 40-60 parole dopo l'H2 nella pagina X"
- **Ordinate per impatto**: quelle che migliorano di più il tuo score compaiono per prime
- **Con stato**: puoi marcarle come "in corso", "completata", "ignorata"

### 9.2 Priorità degli interventi

Ordine di priorità raccomandato per un brand che parte da zero:

1. **Freshness**: aggiorna i contenuti più vecchi di 60 giorni (impatto immediato sul moltiplicatore)
2. **Answer capsule**: aggiungi blocchi di 40-60 parole dopo ogni H2 principale (Citation Power)
3. **Schema markup**: implementa Article con author e dateModified (Extractability)
4. **Copertura query deboli**: crea o aggiorna sezioni per le sotto-query in giallo (Query Reach)
5. **Statistiche**: aggiungi dati quantitativi con attribuzione a fonte (Citation Power)
6. **Entity Home**: aggiorna la pagina About con schema Organization e sameAs links (Brand Authority)

---

## 10. Audience Insights (Google Search Console)

### 10.1 Cos'è e perché è utile

La sezione **Audience** mostra chi cerca realmente il tuo brand su Google e come diversi tipi di utenti vengono serviti (o non serviti) dall'AI.

Visiblee importa le query reali dal tuo account Google Search Console, le classifica per tipo di intento, e raggruppa gli utenti in 2-4 **profili audience**. Ogni profilo rappresenta un segmento di utenti con aspettative diverse — ad esempio "Evaluator" (chi sta confrontando opzioni), "Researcher" (chi cerca informazioni approfondite), o "AI Explorer" (chi usa già AI Mode abitualmente).

### 10.2 Connettere Google Search Console

Dalla pagina **Settings** del progetto, trovi la card "Google Search Console":

1. Clicca **"Connetti Google Search Console"** — vieni reindirizzato all'autorizzazione Google.
2. Dopo l'autorizzazione, selezioni quale **proprietà GSC** associare al progetto (Visiblee suggerisce automaticamente quella che corrisponde all'URL del progetto).
3. Clicca **"Connetti e sincronizza"** — parte il job di importazione dati.

La sincronizzazione importa i dati degli ultimi 90 giorni di ricerca organica. Al termine genera automaticamente i profili audience e i suggerimenti di nuove query target.

### 10.3 Profili audience

Per ogni profilo vedi:
- **Nome e intent dominante**: es. "Evaluator — Decisional intent"
- **% del traffico**: quanta parte delle tue query GSC ricade in questo profilo
- **Device dominante**: mobile o desktop, che influenza le aspettative di risposta
- **Query di esempio**: 3-5 query reali tipiche di questo profilo
- **Citation impact**: percentuale delle tue query target per cui sei citato quando Gemini simula il contesto di questo profilo

### 10.4 Suggerimenti di nuove query target

Nella sezione **Queries**, Visiblee mostra un banner con le query GSC più promettenti da aggiungere come query target. Ogni suggerimento mostra:
- La query originale dal tuo GSC
- Il numero di impressioni (indica quanto traffico potenziale ha)
- Il tipo di intent (informational, comparative, decisional, ecc.)
- Badge "AI query" se è una query che gli utenti tipicamente pongono in modalità AI Mode

Puoi **accettare** (aggiunge automaticamente la query come target) o **ignorare** (rimuove il suggerimento).

---

## 11. Notifiche

Il sistema invia notifiche automatiche per:

- **Analisi completata**: quando un job di analisi termina, ricevi una notifica con il risultato
- **Variazione di score**: se il tuo AI Readiness Score cambia significativamente tra due analisi
- **Nuovo competitor rilevato**: se la citation simulation trova una nuova fonte che ti supera per una query target

Le notifiche sono visibili nel pannello bell in alto a destra. Puoi anche vedere lo storico completo nella sezione Notifications.

---

## 12. Monitoraggio continuativo

### 12.1 Con quale frequenza rieseguire l'analisi

**La maggior parte del monitoraggio è automatica** — il sistema esegue:
- Citation check giornaliero per ogni query attiva
- Booster mode (3 check/giorno × 7 giorni) dopo la prima analisi
- Full analysis mensile
- Sync GSC settimanale (se connesso)

Devi rieseguire manualmente l'analisi completa solo:
- **Dopo aggiornamenti significativi** ai tuoi contenuti (nuova pagina, riscrittura di un articolo)
- **Dopo un aggiornamento algoritmo** di Google (riesegui entro 1-2 settimane)

Puoi avviare un citation check manuale su una singola query dal tab Citations della query stessa.

### 12.2 Cosa monitorare nel tempo

Le metriche da seguire:

| Metrica | Frequenza | Segnale d'allarme |
|---|---|---|
| Citation rate per query | Ad ogni simulazione | Scende sotto il 50% di consistenza |
| AI Readiness Score | A ogni analisi | Calo > 5 punti senza modifiche ai contenuti |
| Freshness multiplier | A ogni analisi | Scende sotto 0.85 (contenuti > 60 giorni) |
| Query Reach | A ogni analisi | Sub-score < 40 su una query prioritaria |
| Nuovi competitor citati | A ogni simulazione | Nuovo player che appare stabilmente |
| Citation impact per profilo | Dopo ogni sync GSC | Un profilo chiave con citation impact < 30% |

### 12.3 Il ciclo operativo raccomandato

**Dopo ogni modifica ai contenuti** (5 min):
- Esegui un'analisi completa per vedere l'impatto sullo score
- Controlla se il passaggio modificato ha migliorato il Citation Power

**Ogni mese** (30-45 minuti):
- Esegui un'analisi completa
- Guarda il trend dello score nel grafico storico
- Aggiorna i contenuti con freshness > 60 giorni
- Implementa 2-3 raccomandazioni dalla sezione Optimization
- Sincronizza GSC per aggiornare i profili audience

**Ogni trimestre** (1-2 ore):
- Rivedi le query target (sono ancora quelle giuste per il tuo business?)
- Aggiungi nuovi contenuti per le query non coperte
- Rivedi il competitor monitoring (ci sono nuovi player nel tuo settore?)
- Controlla i profili audience: l'intent distribution è cambiata?

---

> **Nota**: Visiblee misura la citabilità AI basandosi sui segnali documentati che predicono la citazione. Le citazioni AI sono per natura probabilistiche — non è possibile garantire che un contenuto venga citato. L'obiettivo è migliorare il potenziale e monitorare il trend nel tempo.

---

## 13. GEO Expert

### 13.1 Cos'è il GEO Expert

Il GEO Expert è una sezione di chat AI contestuale che ti aiuta a trasformare le raccomandazioni in azioni concrete. Non è un chatbot generico: ogni conversazione viene avviata con il contesto specifico di una raccomandazione, una query e i dati del tuo competitor principale.

### 13.2 Come avviare una conversazione

Il punto di ingresso naturale è la sezione **Recommendations** di ogni query:

1. Apri una query target dalla sidebar
2. Vai alla tab **Recommendations**
3. Clicca **"Ottimizza con GEO Expert"** su qualsiasi raccomandazione
4. Si apre automaticamente una chat con:
   - Il testo della raccomandazione
   - Il nome e la descrizione del problema
   - La query di contesto
   - Il competitor principale citato per quella query (se disponibile)
   - Un messaggio iniziale dell'AI che analizza il gap e propone un punto di partenza

### 13.3 Cosa puoi fare nella chat

- **Chiedere una riscrittura**: "Riscrivimi il terzo paragrafo con più specificità statistica"
- **Richiedere un brief**: "Genera un brief per un nuovo contenuto che copra questa sotto-query"
- **Capire il perché**: "Perché il mio competitor viene citato e io no per questa query?"
- **Approfondire**: "Quali entità devo includere per migliorare la Brand Authority?"
- **Iterare**: la chat ricorda tutta la conversazione, puoi continuare dove hai lasciato

### 13.4 Limiti

- **30 messaggi** per conversazione (user + assistant). Superato il limite, la conversazione è in sola lettura.
- **50 conversazioni** per progetto (piano Free). Puoi archiviare quelle vecchie dalla lista per recuperare spazio.
- Il GEO Expert **non modifica direttamente** i tuoi contenuti — produce testo che copi e applichi tu. Questo è intenzionale: sei sempre tu a controllare cosa finisce online.

### 13.5 Accedere alle conversazioni precedenti

Tutte le conversazioni sono accessibili dalla sidebar → **GEO Expert**. Ogni conversazione mostra titolo (auto-generato dal contesto), data di aggiornamento e numero di messaggi.
