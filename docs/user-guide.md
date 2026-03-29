# Guida Utente — Come funziona Visiblee

> **Data**: Marzo 2026
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

### 2.3 Query target

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

**Suggerimenti da Google Search Console**: se hai connesso GSC (vedi sezione 10), Visiblee suggerisce automaticamente nuove query target basandosi sulle query reali con cui gli utenti trovano già il tuo sito. Queste compaiono come banner nella sezione Queries.

---

## 3. Scoperta dei contenuti (Discovery)

### 3.1 Come funziona il crawler

Prima di analizzare i tuoi contenuti, Visiblee deve trovarli. La discovery è automatica e usa due tecnologie:

**Brave Search API**: esegue 8 ricerche parallele che combinano il nome del tuo brand, le keyword del tuo settore e le tue query target. Trova tutte le pagine dove il tuo brand ha una presenza online — non solo il tuo sito, ma anche articoli su media di settore, profili su piattaforme, menzioni su Reddit, ecc.

**Gemini Grounding**: per ogni pagina trovata, Gemini classifica se è un contenuto "tuo" (prodotto o controllato dal brand), un "mention" da terzi, o irrilevante. Vengono incluse anche varianti del nome del brand (abbreviazioni, typo comuni, nomi di prodotti correlati).

### 3.2 Come interpretare i risultati

Dopo la discovery, vedi una lista di URL trovati con:
- **Tipo**: "own" (contenuto tuo), "mention" (terzi che parlano di te), "review platform", ecc.
- **URL e titolo**: la pagina trovata
- **Piattaforma**: sito web, YouTube, LinkedIn, Reddit, media, ecc.

È normale che la discovery trovi 20-50+ pagine. Non tutte sono utili per l'analisi.

### 3.3 Confermare vs scartare i contenuti

Prima di procedere all'analisi, devi approvare i contenuti che vuoi includere. Questo passaggio è importante:

**Conferma** i contenuti:
- Che sono effettivamente tuoi (scritti da te, con il tuo brand)
- Che sono rilevanti per le tue query target
- Che sono di qualità sufficiente (non landing page obsolete o pagine in costruzione)

**Scarta** i contenuti:
- Mention da terzi (a meno che non siano molto rilevanti)
- Pagine obsolete o deprecate
- Contenuti in lingue diverse dal target language
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

### 5.1 Overview: AI Readiness Score e i 5 sub-score

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

## 6. Citation Simulation (sezione Queries)

### 6.1 Come funziona

La Citation Simulation risponde alla domanda: "se qualcuno cerca [mia query target] su Google AI Mode, vengo citato?"

Il sistema usa la Gemini API con Google Search Grounding: invia la tua query a Gemini con ricerca web reale attivata, raccoglie le fonti citate nella risposta, e verifica se tra queste fonti compare il tuo sito.

### 6.2 Come leggere i trend

Per ogni query target vedi:
- **Badge "Citato" / "Non citato"**: il risultato dell'ultima simulazione
- **Posizione**: se citato, in quale posizione tra le fonti (posizione 1 = citato per primo)
- **Trend storico**: "Citato 2/4 settimane" — stai costruendo una presenza stabile o stai apparendo in modo casuale?
- **Fonti citate**: i domini che Google ha usato per rispondere (i tuoi competitor diretti per quella query)
- **Sotto-query interne**: le ricerche che Gemini ha fatto internamente per rispondere (il fan-out reale)

### 6.3 Citation per profilo audience (se GSC connesso)

Se hai connesso Google Search Console e Visiblee ha generato profili audience, sotto ogni risultato di citation trovi il **pannello varianti**: mostra come cambia la citation in base al profilo di chi cerca.

Esempio:
```
✓ Citato per "Evaluator"     — posizione 1
✗ Non citato per "Researcher"
✓ Citato per "AI Explorer"   — posizione 3
```

Questo rivela un dato cruciale: potresti essere citato in modo eccellente per gli utenti in fase di valutazione, ma completamente assente per chi cerca informazioni più approfondite. Ogni profilo usa un system prompt diverso che simula il contesto e le aspettative di quell'audience.

### 6.4 Cosa fare con i dati

**Se sei citato in modo stabile** (3-4 settimane su 4): ottimo. Monitora che non scenda. Usa i dati del competitor analysis per capire cosa ha chi ti supera in posizione.

**Se sei citato in modo instabile** (1-2 settimane su 4): i tuoi contenuti sono borderline. Spesso basta aggiornare la data del contenuto (contenuti freschi hanno un boost) o aggiungere uno-due answer capsule.

**Se non sei mai citato**: vai all'Opportunity Map per quella query e identifica le sotto-query non coperte. Quelle sono le lacune strutturali che impediscono la citazione.

---

## 7. Competitor monitoring

### 7.1 Aggiungere competitor

Nella sezione Competitors puoi aggiungere i tuoi principali competitor. Visiblee li trova anche automaticamente durante la citation simulation: ogni fonte citata da Google per le tue query target che non appartiene al tuo sito viene tracciata come potenziale competitor.

### 7.2 Run analysis

Puoi avviare un'analisi del competitor in qualsiasi momento. Il sistema:
1. Fa fetch della pagina citata del competitor
2. La analizza con la stessa pipeline dei tuoi contenuti
3. Produce un Gap Report strutturale

### 7.3 Confronto score e Gap Report

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

## 8. Optimization & Recommendations

### 8.1 Come usare i consigli generati

La sezione Optimization mostra raccomandazioni prioritarie generate dal sistema basandosi sui risultati dell'analisi. Le raccomandazioni sono:

- **Specifiche**: non "migliora i tuoi contenuti" ma "aggiungi un answer capsule di 40-60 parole dopo l'H2 nella pagina X"
- **Ordinate per impatto**: quelle che migliorano di più il tuo score compaiono per prime
- **Con stato**: puoi marcarle come "in corso", "completata", "ignorata"

### 8.2 Priorità degli interventi

Ordine di priorità raccomandato per un brand che parte da zero:

1. **Freshness**: aggiorna i contenuti più vecchi di 60 giorni (impatto immediato sul moltiplicatore)
2. **Answer capsule**: aggiungi blocchi di 40-60 parole dopo ogni H2 principale (Citation Power)
3. **Schema markup**: implementa Article con author e dateModified (Extractability)
4. **Copertura query deboli**: crea o aggiorna sezioni per le sotto-query in giallo (Query Reach)
5. **Statistiche**: aggiungi dati quantitativi con attribuzione a fonte (Citation Power)
6. **Entity Home**: aggiorna la pagina About con schema Organization e sameAs links (Brand Authority)

---

## 9. Audience Insights (Google Search Console)

### 9.1 Cos'è e perché è utile

La sezione **Audience** mostra chi cerca realmente il tuo brand su Google e come diversi tipi di utenti vengono serviti (o non serviti) dall'AI.

Visiblee importa le query reali dal tuo account Google Search Console, le classifica per tipo di intento, e raggruppa gli utenti in 2-4 **profili audience**. Ogni profilo rappresenta un segmento di utenti con aspettative diverse — ad esempio "Evaluator" (chi sta confrontando opzioni), "Researcher" (chi cerca informazioni approfondite), o "AI Explorer" (chi usa già AI Mode abitualmente).

### 9.2 Connettere Google Search Console

Dalla pagina **Settings** del progetto, trovi la card "Google Search Console":

1. Clicca **"Connetti Google Search Console"** — vieni reindirizzato all'autorizzazione Google.
2. Dopo l'autorizzazione, selezioni quale **proprietà GSC** associare al progetto (Visiblee suggerisce automaticamente quella che corrisponde all'URL del progetto).
3. Clicca **"Connetti e sincronizza"** — parte il job di importazione dati.

La sincronizzazione importa i dati degli ultimi 90 giorni di ricerca organica. Al termine genera automaticamente i profili audience e i suggerimenti di nuove query target.

### 9.3 Profili audience

Per ogni profilo vedi:
- **Nome e intent dominante**: es. "Evaluator — Decisional intent"
- **% del traffico**: quanta parte delle tue query GSC ricade in questo profilo
- **Device dominante**: mobile o desktop, che influenza le aspettative di risposta
- **Query di esempio**: 3-5 query reali tipiche di questo profilo
- **Citation impact**: percentuale delle tue query target per cui sei citato quando Gemini simula il contesto di questo profilo

### 9.4 Suggerimenti di nuove query target

Nella sezione **Queries**, Visiblee mostra un banner con le query GSC più promettenti da aggiungere come query target. Ogni suggerimento mostra:
- La query originale dal tuo GSC
- Il numero di impressioni (indica quanto traffico potenziale ha)
- Il tipo di intent (informational, comparative, decisional, ecc.)
- Badge "AI query" se è una query che gli utenti tipicamente pongono in modalità AI Mode

Puoi **accettare** (aggiunge automaticamente la query come target) o **ignorare** (rimuove il suggerimento).

---

## 10. Notifiche

Il sistema invia notifiche automatiche per:

- **Analisi completata**: quando un job di analisi termina, ricevi una notifica con il risultato
- **Variazione di score**: se il tuo AI Readiness Score cambia significativamente tra due analisi
- **Nuovo competitor rilevato**: se la citation simulation trova una nuova fonte che ti supera per una query target

Le notifiche sono visibili nel pannello bell in alto a destra. Puoi anche vedere lo storico completo nella sezione Notifications.

---

## 11. Monitoraggio continuativo

### 11.1 Con quale frequenza rieseguire l'analisi

L'analisi completa dei contenuti va rieseguita:

- **Dopo ogni aggiornamento significativo** dei tuoi contenuti (nuova pagina, riscrittura di un articolo)
- **Mensilmente** come check di routine per monitorare il trend dello score
- **Dopo un aggiornamento algoritmo** di Google (quando senti di un cambiamento a AI Overviews, riesegui l'analisi entro 1-2 settimane)

La citation simulation si avvia manualmente dalla sezione Queries per ogni query target.

### 11.2 Cosa monitorare nel tempo

Le metriche da seguire:

| Metrica | Frequenza | Segnale d'allarme |
|---|---|---|
| Citation rate per query | Ad ogni simulazione | Scende sotto il 50% di consistenza |
| AI Readiness Score | A ogni analisi | Calo > 5 punti senza modifiche ai contenuti |
| Freshness multiplier | A ogni analisi | Scende sotto 0.85 (contenuti > 60 giorni) |
| Query Reach | A ogni analisi | Sub-score < 40 su una query prioritaria |
| Nuovi competitor citati | A ogni simulazione | Nuovo player che appare stabilmente |
| Citation impact per profilo | Dopo ogni sync GSC | Un profilo chiave con citation impact < 30% |

### 11.3 Il ciclo operativo raccomandato

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
