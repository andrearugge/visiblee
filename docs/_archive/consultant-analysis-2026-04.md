# Sintesi analisi tecnica esterna — Aprile 2026

> **Data ricezione report**: 2026-04-30
> **Documento originale**: `Visiblee_Analisi_e_Piano_di_Intervento.pdf` (16 pagine, fornito al cliente; non in repo perché binario)
> **Autore**: consulente tecnico esterno
> **Validazione**: ri-validata sul branch `dev` il 2026-04-30 (versione vecchia di main era stata validata in precedenza ed era diversa)
> **Stato**: archivio storico — il piano d'azione derivato è in `docs/_features/v2-implementation-plan.md` (Fase A.0 + Fase F)

Questo documento è la fonte del razionale dietro la **Fase A.0** (prerequisiti scoring) e la **Fase F** (robustezza differibile) del piano v2. Quando un task di A.0 o F viene eseguito, fare riferimento alla sezione corrispondente per il "perché".

---

## Sintesi del consulente

> Visiblee è un prodotto con metodologia solida, data model corretto, stack appropriato. Il codice attuale — generato interamente con AI — non funziona: bug critici che distorcono i risultati, pipeline duplicata, feature documentate ma non implementate. Non serve rewrite, serve intervento strutturato in 4 fasi.

Il consulente ha proposto una collaborazione commerciale a €9.000 (fasi 1+2). Decisione presa: **eseguire le fasi 1 e 2 internamente con Claude Code**, integrate nel piano v2 esistente come Fase A.0 (critici) e Fase F (differibili). Le fasi 3-4 (BM25, drift detection, ML calibration) restano fuori scope per ora.

---

## Cose da NON cambiare (conferma del consulente)

- Metodologia 5-score con pesi dalla letteratura (asset differenziante).
- Stack: Python + FastAPI + PostgreSQL + pgvector + Voyage AI + Gemini.
- Data model: Project → Content → Passage → Score → Snapshot.
- Job queue PostgreSQL con `FOR UPDATE SKIP LOCKED` (scalabile con più worker).
- Citation verification via Gemini Grounding (unica via ufficiale per AI Mode).

---

## Validazione dei 15 punti sul branch `dev`

Stati: 🟢 RISOLTO · 🟡 PARZIALE · 🔴 ANCORA PRESENTE · ❓ FALSO/RIDIMENSIONATO

### Bug critici

| # | Affermazione | Stato dev | File coinvolti | Mappatura piano |
|---|---|---|---|---|
| P1 | `CitationCheck`: DELETE+INSERT distrugge lo storico settimanale | 🔴 | `services/analyzer/app/citation_check.py:398-414` | **A.0.2** |
| P2 | `score_extractability` riceve `robots_blocked=None` | 🟡 — parametro passato, ma `Content.robotsTxtBlocks` non esiste nello schema → ricalcolato ad ogni run | `services/analyzer/app/scoring.py:284-326`, `full_pipeline.py:537` | **A.0.1 + A.0.7** (persistenza) |
| P3 | Definiteness ≡ answer_first; nessuna logica hedge-words | 🔴 | `services/analyzer/app/scoring.py:133-134` | **A.0.6** |
| P4 | `worker.py` (handler `fetch_content`) salva passaggi senza campi v2 | ❓ FALSO — `_auto_fetch_unfetched` salva tutti i campi v2, nessuna divergenza | `services/analyzer/app/full_pipeline.py:236-258` | nessuna azione |
| P5 | `kg_presence` rigido: solo `sameAs` JSON-LD, nessun proxy Wikipedia | 🟡 | `services/analyzer/app/scoring.py:176-200` | **F.1** |

### Architetturali

| # | Affermazione | Stato dev | File coinvolti | Mappatura piano |
|---|---|---|---|---|
| P6 | Doppia pipeline `pipeline.py` (preview, coverage binaria) vs `full_pipeline.py` (4-tier) | 🔴 | `services/analyzer/app/pipeline.py:78`, `full_pipeline.py:537` | **A.0.4** |
| P7 | Worker FIFO, no priorità, timeout uniforme | 🟡 — `scheduler.py` introdotto ma è per cron jobs, non per priorità | `services/analyzer/app/worker.py:82-106` | **F.4** |
| P8 | Discovery one-shot, nessun cron periodico | 🟢 — `scheduler.py` con `create_monthly_analysis_jobs`, `create_weekly_gsc_sync_jobs`, `create_daily_citation_jobs` | `services/analyzer/app/scheduler.py` | nessuna azione |
| P9 | Doppio sistema competitor (`competitor_pipeline.py` vs `competitor_analysis.py`) non integrato | 🟡 — coesistono, no shared cache, no tabella gap report dedicata | entrambi i file | **F.3** |
| P10 | Embedding non cachati: colonne `Passage.embedding`, `FanoutQuery.embedding` orfane | 🟡 — colonne ancora vuote, `lastContentHash` salvato ma non usato per cache lookup | `services/analyzer/app/embeddings.py`, `apps/web/prisma/schema.prisma:204,265` | **A.0.3** |
| P11 | `Content.rawHtml` salvato senza cap di dimensione | 🔴 | `services/analyzer/app/fetcher.py:150`, `full_pipeline.py:225` | **F.5** |

### Concettuali

| # | Affermazione | Stato dev | File coinvolti | Mappatura piano |
|---|---|---|---|---|
| P12 | Freshness usa `lastFetchedAt` come fallback | 🟢 — implementato correttamente | `services/analyzer/app/scoring.py:418-457` | nessuna azione |
| P13 | Source Authority binaria (no `presence × freshness × quality`) | 🟡 | `services/analyzer/app/scoring.py:374-413` | **F.2** |
| P14 | Categorie fanout perse (`queryType='generated'` hardcoded) | 🔴 | `services/analyzer/app/full_pipeline.py:278`, `scoring.py:69-87` | **A.0.5** |
| P15 | Competitor auto-discovery dai `cited_sources` | 🟢 — `save_competitor_appearances` in `citation_check.py:258-325` con `source='citation'`, `isConfirmed=false` | `services/analyzer/app/citation_check.py` | nessuna azione |

### Bilancio

- **4 RISOLTI** (P4 falso, P8, P12, P15 — dev è già più avanti dell'analisi originale)
- **5 PARZIALI** mappati a Fase F (P5, P7, P9, P13) o ad A.0 (P2, P10)
- **4 CRITICI ANCORA APERTI** mappati ad A.0 (P1, P3, P6, P14) e F (P11)
- **2 BUG META** scoperti durante la ri-validazione (vedi sotto)

---

## Bug aggiuntivi scoperti durante la ri-validazione

### M1. `robotsTxtBlocks` calcolato e usato ma non persistito

`fetcher.py` raccoglie `robots_txt_blocks`, `score_extractability` lo riceve e lo usa, ma lo schema Prisma **non ha la colonna** `Content.robotsTxtBlocks`. Conseguenza: il dato viene ricalcolato ad ogni run anche se il `robots.txt` di un sito non cambia mai. Inefficiente e fragile.

**Mappato a**: A.0.1 (migration) + A.0.7 (persistenza in `_auto_fetch_unfetched`).

### M2. Race condition potenziale su CitationCheck

Il `DELETE WHERE projectId AND targetQueryId` di `save_citation_check_single` non è idempotente. Con la Fase A che introduce `scheduled_citation_daily` + `scheduled_citation_burst` (3/giorno per query), due job concorrenti per la stessa query possono interferire. Anche eliminando il DELETE (A.0.2), va aggiunto un constraint unique o usato `ON CONFLICT DO UPDATE` per gestire potenziali duplicati identici.

**Mappato a**: A.0.2 (chiarito nella nota di task — usare INSERT idempotente).

---

## Piano del consulente vs piano applicato

Il consulente proponeva 4 fasi sequenziali. Il nostro piano applicato è diverso perché si integra col piano v2 già attivo:

| Fase consulente | Mappatura nel piano v2 |
|---|---|
| Fase 1 — Fix critici (CitationCheck, definiteness, robots, kg_presence, queryType, pipeline) | **Fase A.0** (prerequisito di Fase A) |
| Fase 2 — Robustezza (caching embedding, worker multi-canale, discovery mensile, competitor unificato, rawHtml cap) | Embedding caching → **A.0.3** (anticipato come prereq di A); discovery mensile → già esistente in `scheduler.py`; resto → **Fase F** |
| Fase 3 — Scoring evoluto (BM25 ibrido, drift detection, scoring incrementale) | Out of scope. Riconsiderare dopo 3-4 mesi di dati post-lancio v2 |
| Fase 4 — ML calibration (logistic regression, isotonic, bayesian priors) | Out of scope. Prerequisito: 3-4 mesi × 50+ progetti |

---

## Lista finale hedge words (per task A.0.6)

Lista usata per implementare `score_definiteness` distinto da `score_answer_first`. **Italiano primario** (mercato target), **inglese secondario** (supportato per coerenza UX multi-lingua).

### IT (primaria)

```python
HEDGE_WORDS_IT = [
    # Modali epistemici
    "forse", "magari", "eventualmente", "presumibilmente",
    "probabilmente", "apparentemente",
    # Verbi modali deboli
    "potrebbe", "potrebbero", "può darsi", "potrebbe darsi",
    # Frequenza imprecisa
    "a volte", "talvolta", "spesso", "qualche volta",
    "di solito", "generalmente", "in genere", "normalmente",
    "tipicamente", "tendenzialmente",
    # Approssimazione
    "circa", "all'incirca", "pressappoco", "intorno a",
    # Cognitivi attenuati
    "pare che", "sembra che", "sembrerebbe", "parrebbe",
    "si direbbe", "si pensa che", "si ritiene che",
    # Attenuatori
    "piuttosto", "abbastanza", "alquanto",
    "in qualche modo", "in una certa misura",
]
```

### EN (secondaria)

```python
HEDGE_WORDS_EN = [
    # Modal hedges
    "perhaps", "maybe", "possibly", "presumably",
    "probably", "apparently", "supposedly",
    # Weak modals (epistemic)
    "could", "might", "may", "would",
    # Frequency
    "sometimes", "often", "usually", "generally",
    "typically", "tends to", "tend to",
    # Approximation
    "roughly", "about", "around", "approximately",
    "nearly", "almost",
    # Cognitive hedges
    "seems", "appears", "looks like",
    "it seems that", "it appears that",
    # Attenuators
    "somewhat", "rather", "fairly",
    "kind of", "sort of",
]
```

### Algoritmo

```
hedge_count = sum(1 for w in HEDGE_WORDS_LANG if w in passage_text.lower())
density = hedge_count / max(word_count, 1)
# Saturation: 5 hedge in un passaggio di 100 word → score = 0.0
# 0 hedge → score = 1.0
score = max(0.0, min(1.0, 1.0 - (hedge_count / 5.0)))
```

`language` arriva da `Project.targetLanguage` o, in alternativa, da `Content.detectedLanguage` (introdotto in Fase C.2). Default: IT se non specificato.

### Note di tuning

- Lista da rivedere dopo 3 mesi di uso reale. Aggiungere/rimuovere parole se l'analisi qualitativa lo suggerisce.
- Falsi positivi noti: "in genere" può essere parte di nome proprio o termine tecnico. Per ora accettiamo il rumore — la frequenza è bassa.
- Match case-insensitive, con word boundary (`\bforse\b`, non `forse` in `forsennato`).

---

## Tecniche avanzate (Sezione 5 del documento originale)

Citate come north star, non azionabili nel breve. Quando avremo 3-4 mesi di dati post-lancio:

- **Score calibration** (isotonic regression): trasformare lo score in P(citato) calibrata empiricamente.
- **Contrastive analysis** sui `userCitedSegment` per estrarre pattern strutturali dei passaggi citati.
- **Active learning** sulle citation checks (uncertainty sampling) per ridurre i costi Gemini.
- **Survival analysis** sulla freshness (metà vita per tipo di contenuto e settore).
- **Graph-based authority** (HITS) sui `cited_sources` accumulati.
- **Drift detection** (ADWIN / Page-Hinkley) come early warning per aggiornamenti Gemini.
- **Share of Model** come metrica di prodotto futura.

---

## Decisioni strategiche prese (2026-04-30)

| Domanda | Decisione |
|---|---|
| Eseguire internamente o ingaggiare consulente? | **Internamente**, con Claude Code. |
| Mercato primario IT o EN? | **IT primario**, EN supportato. Heuristiche segmenter (hedge words, answer-first, entity density) tarate prima per IT. |
| Rischio refactoring distruttivo (eliminazione `pipeline.py`)? | Basso — prodotto in dev locale, no utenti reali, no dati storici da preservare. **OK procedere**. |
| Fase 3-4 (BM25, ML)? | **Out of scope** per ora. Riconsiderare dopo accumulo di 3-4 mesi di dati post-lancio v2. |
| Modalità di integrazione col piano v2? | **Spalmati nelle fasi (opzione C)**: Fase A.0 (prerequisito di A) per i critici, Fase F (post-E) per i differibili. |

---

## Rischi residui da monitorare

| Rischio | Probabilità | Impatto | Mitigazione |
|---|---|---|---|
| Google cambia Gemini e invalida i segnali | Alta (già 2 volte nel 2025) | Alto | Drift detection (futuro). Architettura con pesi aggiornabili. |
| Costi API API superiori alle aspettative | Media → bassa dopo A.0.3 | Medio | A.0.3 (embedding cache) → -60-80% Voyage AI. Active learning futuro. |
| Divergenza preview/full ricompare | Bassa dopo A.0.4 | Alto | Una sola codebase dopo eliminazione `pipeline.py`. Policy: nessuna feature aggiunta solo al preview. |
| Heuristiche IT incomplete | Media | Medio | Lista hedge-words IT (sopra). Test su corpus IT reale durante validazione A.0. Tuning post-lancio. |
| Race condition CitationCheck (M2) | Bassa ma presente | Alto se attiva | A.0.2 con INSERT idempotente; constraint unique. |

---

## Glossario

- **AI Readiness Score**: score composito a 5 dimensioni (Query Reach 30%, Citation Power 25%, Brand Authority 20%, Extractability 15%, Source Authority 10%).
- **Fan-out query**: sotto-query semantiche generate da una target query (related, implicit, comparative, exploratory, decisional, recent).
- **Citation check**: verifica via Gemini Grounding se il dominio dell'utente compare nelle fonti per una specifica query.
- **Beta(α, β)**: distribuzione bayesiana usata per stimare il citation rate con intervallo di confidenza.
