# Visiblee — Piano di Refactoring: Scoring Engine v2

> **Per**: Claude Code
> **Contesto**: leggere `/docs/visiblee-methodology-v2.md` per capire il razionale di ogni scelta.
> **Stato attuale**: Fine Fase 3. Il progetto ha un scoring engine funzionante con 5 score (scoring.py, full_pipeline.py, pipeline.py). Questo piano lo riscrive completamente.
> **Approccio**: refactoring netto — si riscrivono i moduli di scoring, non si aggiungono patch.

---

## Decisioni già prese (non negoziabili)

### Score rinominati
| Vecchio nome codice | Nuovo nome codice | Nome UI (EN) | Peso |
|---|---|---|---|
| `fanout_coverage_score` | `fanout_coverage_score` | Query Reach | 30% |
| `passage_quality_score` | `citation_power_score` | Citation Power | 25% |
| `entity_coherence_score` | `entity_authority_score` | Brand Authority | 20% |
| `chunkability_score` | `extractability_score` | Extractability | 15% |
| `cross_platform_score` | `source_authority_score` | Source Authority | 10% |

### Freshness: moltiplicatore sul composite
- < 30 giorni: ×1.15
- 30-60 giorni: ×1.00
- 60-120 giorni: ×0.85
- > 120 giorni: ×0.70

### Coverage: 4 fasce (non più soglia binaria)
- ≥ 0.88: eccellente (peso 1.0)
- 0.75-0.87: buona (peso 0.7)
- 0.60-0.74: debole (peso 0.3)
- < 0.60: non coperta (peso 0.0)

### Nuove feature nel pipeline
- **Discovery migliorata**: query Brave arricchite (intitle, backlink, settore, variazioni) + Gemini Grounding come sorgente supplementare
- Citation verification via Gemini API con Grounding
- Competitor citation analysis automatico
- Schema markup check
- AI crawler access check (robots.txt)
- Entity density calculation (NER euristico)
- Position score per passaggio

### Free tier limits
- 1 progetto attivo
- 5 query target
- 20 contenuti monitorati
- Storico 4 settimane

---

## Sequenza dei task

### Overview delle fasi

Il refactoring è diviso in 4 blocchi:

1. **Blocco 0 (Task 4.0)**: Discovery pipeline improvement — critico, senza una buona discovery il resto vale poco
2. **Blocco A (Task 4.1-4.5)**: Schema migration + config + segmenter + fetcher — le fondamenta
3. **Blocco B (Task 4.6-4.10)**: Nuovo scoring engine — il cuore
4. **Blocco C (Task 4.11-4.15)**: Citation verification + competitor analysis + UI updates

---

## BLOCCO 0 — Discovery Pipeline Improvement

### Task 4.0: Migliora la content discovery con query Brave arricchite + Gemini Grounding

**Priorità**: CRITICA — senza una buona discovery il ranking vale poco e il cliente non percepisce valore.

**Il problema attuale**: La discovery non trova articoli press/blog creati per il brand. Esempio concreto: "Marino Allestimenti" (marinoallestimenti.com) ha articoli su testate e blog di settore, ma la discovery non li trova perché:
1. La query news cerca solo su grandi testate nazionali hardcoded
2. La query generica (`"Brand" -site:domain`) restituisce solo 20 risultati e per brand con cognome/nome comune si riempiono di rumore
3. Non c'è ricerca per backlink (pagine che linkano al dominio)
4. Non ci sono variazioni del brand name (srl, s.r.l., ecc.)
5. Non c'è uso dell'operatore `intitle:` di Brave

**File da toccare:**
- `services/analyzer/app/discovery.py`
- Tutti i chiamanti di `discover_content` (worker.py, eventuali route)

**Cosa fare:**

#### 1. Aggiungere parametro `target_queries` alla funzione `discover_content`

```python
async def discover_content(
    website_url: str,
    brand_name: str,
    language: str = "en",
    target_queries: list[str] | None = None,  # NUOVO
) -> list[dict[str, Any]]:
```

#### 2. Aggiungere funzione helper per keyword di settore

```python
def _extract_sector_keywords(target_queries: list[str], brand_name: str) -> str:
    """Extract 2-3 sector keywords from target queries for more focused discovery."""
    if not target_queries:
        return ""

    stopwords_it = {"come", "cosa", "qual", "quale", "dove", "quando", "perché", "chi",
                    "il", "la", "le", "lo", "i", "gli", "di", "del", "della", "dei",
                    "per", "con", "su", "tra", "fra", "è", "sono", "un", "una", "che",
                    "non", "più", "anche", "questo", "quello", "nella", "nel", "al", "alla"}
    stopwords_en = {"what", "how", "where", "when", "why", "who", "which", "the", "a", "an",
                    "is", "are", "was", "for", "and", "or", "but", "in", "on", "at", "to",
                    "of", "with", "from", "by", "not", "this", "that", "your", "my", "can"}
    stopwords = stopwords_it | stopwords_en
    brand_tokens = set(brand_name.lower().split())

    all_words = " ".join(target_queries).lower().split()
    keywords = [
        w for w in all_words
        if w not in stopwords and w not in brand_tokens and len(w) > 3 and w.isalpha()
    ]

    seen = set()
    unique = []
    for w in keywords:
        if w not in seen:
            seen.add(w)
            unique.append(w)

    return " ".join(unique[:3])
```

#### 3. Aggiungere funzione helper per variazioni brand name

```python
def _generate_brand_variations(brand_name: str) -> list[str]:
    """Generate common legal and formatting variations of the brand name."""
    variations = []
    name = brand_name.strip()
    name_lower = name.lower()

    legal_suffixes = ["srl", "s.r.l.", "spa", "s.p.a.", "snc", "s.n.c.",
                      "sas", "s.a.s.", "ltd", "llc", "inc", "gmbh"]

    has_suffix = any(name_lower.endswith(s) or name_lower.endswith(f" {s}") for s in legal_suffixes)
    if not has_suffix:
        variations.append(f"{name} srl")
        variations.append(f"{name} s.r.l.")

    if has_suffix:
        clean = name
        for s in legal_suffixes:
            for fmt in [f" {s}", f" {s.upper()}", f" {s.title()}"]:
                clean = clean.replace(fmt, "")
        clean = clean.strip()
        if clean and clean.lower() != name_lower:
            variations.append(clean)

    return variations[:4]
```

#### 4. Aggiungere 4 query Brave supplementari in `discover_content`

Dopo la costruzione della lista `queries` esistente (le 8 query originali — NON rimuoverle), appendere:

```python
sector_keywords = _extract_sector_keywords(target_queries or [], brand_name)
brand_variations = _generate_brand_variations(brand_name)

additional_queries = [
    # 9. Brand nel titolo — LA PIÙ IMPORTANTE per press/blog
    (f'intitle:"{brand_name}" -site:{domain}', 20),
    # 10. Backlink discovery — pagine che citano/linkano il dominio
    (f'"{domain}" -site:{domain}', 10),
]

# 11. Brand + settore (solo se ci sono keyword)
if sector_keywords:
    additional_queries.append(
        (f'"{brand_name}" {sector_keywords} -site:{domain}', 10)
    )

# 12. Variazioni ragione sociale
if brand_variations:
    variation_parts = " OR ".join(f'"{v}"' for v in brand_variations[:2])
    additional_queries.append(
        (f'({variation_parts}) -site:{domain}', 10)
    )

queries = queries + additional_queries
```

#### 5. Aggiungere Gemini Grounding come sorgente supplementare

Dopo la deduplicazione dei risultati Brave e PRIMA della classificazione Gemini, aggiungere:

```python
async def _discover_via_gemini_grounding(
    brand_name: str,
    target_queries: list[str],
    user_domain: str,
    existing_urls: set[str],
) -> list[dict]:
    """
    Use Gemini with Google Search grounding to find brand mentions in Google's index.
    Supplements Brave results with sources that Google can see but Brave might miss.
    """
    # Importa il client Gemini (già inizializzato in discovery.py o scoring.py)
    try:
        from google import genai as google_genai
        gemini = google_genai.Client(api_key=config.GOOGLE_AI_API_KEY) if config.GOOGLE_AI_API_KEY else None
    except ImportError:
        gemini = None

    if not gemini or not target_queries:
        return []

    additional = []
    for query_text in target_queries[:5]:  # Cap al free tier
        try:
            response = await gemini.aio.models.generate_content(
                model="gemini-2.5-flash",
                contents=f"{query_text} {brand_name}",
                config={"tools": [{"google_search": {}}]},
            )

            if not response.candidates:
                continue

            candidate = response.candidates[0]
            grounding = getattr(candidate, 'grounding_metadata', None)
            if not grounding or not getattr(grounding, 'grounding_chunks', None):
                continue

            for chunk in grounding.grounding_chunks:
                web = getattr(chunk, 'web', None)
                if not web or not web.uri:
                    continue
                url = web.uri
                if url in existing_urls:
                    continue

                chunk_domain = urlparse(url).netloc.lstrip("www.")
                title = web.title or ""

                # Aggiungi se è del brand OR se menziona il brand nel titolo
                if user_domain in chunk_domain or brand_name.lower() in title.lower():
                    additional.append({
                        "url": url,
                        "title": title,
                        "snippet": "",
                        "source": "gemini_grounding",
                    })

        except Exception as e:
            log.warning(f"Gemini grounding discovery failed for '{query_text}': {e}")
            continue

    return additional
```

Integrare nel flusso di `discover_content`:

```python
# Dopo dedup Brave, prima della classificazione:
seen_urls = {r["url"] for r in all_results}
gemini_results = await _discover_via_gemini_grounding(
    brand_name, target_queries or [], domain, seen_urls
)
for gr in gemini_results:
    if gr["url"] not in seen_urls:
        seen_urls.add(gr["url"])
        all_results.append(gr)

if gemini_results:
    log.info(f"Discovery: Gemini Grounding added {len(gemini_results)} URLs")
```

**NOTA IMPORTANTE sulla API Gemini Grounding**: la sintassi `config={"tools": [{"google_search": {}}]}` potrebbe variare in base alla versione del SDK `google-genai` installata. Controlla https://ai.google.dev/gemini-api/docs/google-search per la sintassi corretta. In alcune versioni serve `GenerateContentConfig(tools=[Tool(google_search=GoogleSearch())])` o simile. Se il SDK non supporta ancora il google_search tool, logga un warning e skippa — NON crashare la discovery.

#### 6. Alzare il cap di classificazione

Il cap attuale è `all_results[:60]`. Con più query (12 Brave + Gemini), il numero di risultati potrebbe salire. Alzare a 80:

```python
classified = await _classify_with_gemini(all_results[:80], brand_name, domain)
```

#### 7. Aggiornare i chiamanti

Cerca tutti i punti dove `discover_content` viene chiamata e passa `target_queries` se disponibili:
- In `worker.py`: quando processa un job `discovery`, carica le target queries dal DB e passale
- Se usata altrove: adattare di conseguenza

#### 8. Aggiungere logging dettagliato per source

```python
# Dopo la dedup finale, prima della classificazione
brave_count = sum(1 for r in all_results if r.get("source") != "gemini_grounding")
gemini_count = sum(1 for r in all_results if r.get("source") == "gemini_grounding")
log.info(
    f"Discovery for {domain}: {brave_count} from Brave + {gemini_count} from Gemini Grounding "
    f"= {len(all_results)} total unique URLs"
)
```

**Criterio di verifica:**
1. La discovery per "Marino Allestimenti" (marinoallestimenti.com) con query target tipo "allestimenti per eventi" trova articoli sulle testate (via query `intitle:`)
2. La discovery funziona anche senza `target_queries` (backward compatibility)
3. Se Gemini Grounding non è disponibile (API key mancante o SDK incompatibile), la discovery continua a funzionare con solo Brave (graceful degradation)
4. Il logging mostra il breakdown per sorgente

---

## BLOCCO A — Fondamenta

### Task 4.1: Aggiorna CLAUDE.md + documenti di progetto

**File da toccare:**
- `CLAUDE.md`

**Cosa fare:**
1. Aggiornare la tabella "Score naming" con i nuovi nomi:
   - `passage_quality_score` → `citation_power_score` (UI: Citation Power)
   - `entity_coherence_score` → `entity_authority_score` (UI: Brand Authority)
   - `chunkability_score` → `extractability_score` (UI: Extractability — nome UI invariato)
2. Aggiungere la sezione "Phase 4 — Scoring Engine v2" con la lista dei task
3. Aggiornare lo stato: "Phase: 4 — Scoring Engine v2 — IN PROGRESS"

**Criterio di verifica:** CLAUDE.md aggiornato, nessun errore di sintassi.

---

### Task 4.2: Prisma schema migration — Rinomina score e aggiungi nuovi campi

**File da toccare:**
- `apps/web/prisma/schema.prisma`
- Nuova migration Prisma

**Cosa fare:**

1. **Rinominare colonne nelle tabelle esistenti** (via migration SQL raw, non rename Prisma che droppa e ricrea):

In `ProjectScoreSnapshot`:
- `passageQualityScore` → `citationPowerScore`
- `entityCoherenceScore` → `entityAuthorityScore`
- `chunkabilityScore` → `extractabilityScore`
- `crossPlatformScore` → `sourceAuthorityScore`

In `PreviewAnalysis`:
- Stesse rinominazioni

In `PassageScore` — **sostituire i 5 vecchi criteri** con i 6 nuovi:
- Rimuovere: `selfContainedness`, `claimClarity`, `informationDensity`, `completeness`, `verifiability`
- Aggiungere: `positionScore`, `entityDensity`, `statisticalSpecificity`, `definiteness`, `answerFirst`, `sourceCitation`

In `ContentScore`:
- `passageQualityScore` → `citationPowerScore`
- `chunkabilityScore` → `extractabilityScore`

2. **Aggiungere nuovi campi** alla tabella `Content`:
- `rawHtml TEXT` — HTML originale preservato (per schema check)
- `schemaMarkup Json?` — schema JSON-LD estratti dalla pagina
- `hasArticleSchema Boolean @default(false)`
- `hasFaqSchema Boolean @default(false)`
- `hasOrgSchema Boolean @default(false)`
- `dateModifiedSchema DateTime?` — dateModified dallo schema Article
- `lastContentHash String?` — hash del contenuto per rilevare modifiche

3. **Aggiungere nuovi campi** alla tabella `Passage`:
- `relativePosition Float?` — posizione relativa nel documento (0.0 = inizio, 1.0 = fine)
- `entityDensity Float?` — % di named entities nel passaggio
- `hasStatistics Boolean @default(false)` — contiene dati numerici con contesto
- `hasSourceCitation Boolean @default(false)` — contiene citazioni a fonti esterne
- `isAnswerFirst Boolean @default(false)` — prima frase è sostanziale/definitoria

4. **Nuova tabella** `CitationCheck`:
```prisma
model CitationCheck {
  id            String   @id @default(uuid())
  projectId     String
  targetQueryId String
  snapshotId    String?
  citedSources  Json     // [{url, title, domain, isUser, isCompetitor}]
  userCited     Boolean  @default(false)
  searchQueries Json?    // query di ricerca usate da Gemini (fan-out reale)
  rawResponse   String?  // risposta Gemini completa (per debug)
  checkedAt     DateTime @default(now())

  project     Project              @relation(fields: [projectId], references: [id], onDelete: Cascade)
  targetQuery TargetQuery          @relation(fields: [targetQueryId], references: [id], onDelete: Cascade)
  snapshot    ProjectScoreSnapshot? @relation(fields: [snapshotId], references: [id])

  @@index([projectId])
  @@index([targetQueryId])
  @@map("citation_checks")
}
```

5. **Nuova tabella** `ContentVersion` (per before/after comparison):
```prisma
model ContentVersion {
  id          String   @id @default(uuid())
  contentId   String
  snapshotId  String
  passageData Json     // snapshot dei passaggi con score al momento dell'analisi
  contentHash String   // hash per detect cambiamenti
  createdAt   DateTime @default(now())

  content  Content              @relation(fields: [contentId], references: [id], onDelete: Cascade)
  snapshot ProjectScoreSnapshot @relation(fields: [snapshotId], references: [id], onDelete: Cascade)

  @@index([contentId])
  @@map("content_versions")
}
```

6. **Aggiungere campo** alla tabella `Project`:
- `optimizationFocus String?` — la scelta del wizard ("content_quality" | "brand_authority" | "cross_platform" | "technical")
- `aiPlatformTarget String @default("all")` — "google_ai" | "chatgpt" | "perplexity" | "all"

7. **Aggiungere campo** alla tabella `Recommendation`:
- `sprintGroup String?` — raggruppa le raccomandazioni in sprint

8. Aggiungere le relazioni inverse nei modelli esistenti (Project, TargetQuery, etc.)

**Come eseguire la migration:**
- Creare un file SQL raw nella migration (non usare `prisma migrate dev` per le rinominazioni — farebbe drop+create). Usare `ALTER TABLE ... RENAME COLUMN`.
- Dopo il SQL raw, aggiornare il schema.prisma per riflettere i nuovi nomi.
- Eseguire `npx prisma migrate dev --name scoring-engine-v2`.

**Criterio di verifica:** `npx prisma migrate deploy` funziona senza errori. `npx prisma generate` produce il client aggiornato.

---

### Task 4.3: Aggiorna config.py con nuovi parametri

**File da toccare:**
- `services/analyzer/app/config.py`

**Cosa fare:** Aggiungere:

```python
# Coverage thresholds (4 tiers)
COVERAGE_EXCELLENT: float = float(os.getenv("COVERAGE_EXCELLENT", "0.88"))
COVERAGE_GOOD: float = float(os.getenv("COVERAGE_GOOD", "0.75"))
COVERAGE_WEAK: float = float(os.getenv("COVERAGE_WEAK", "0.60"))

# Freshness multipliers
FRESHNESS_BOOST_30D: float = float(os.getenv("FRESHNESS_BOOST_30D", "1.15"))
FRESHNESS_NEUTRAL: float = float(os.getenv("FRESHNESS_NEUTRAL", "1.00"))
FRESHNESS_DECAY_120D: float = float(os.getenv("FRESHNESS_DECAY_120D", "0.85"))
FRESHNESS_PENALTY: float = float(os.getenv("FRESHNESS_PENALTY", "0.70"))

# Entity density benchmark
ENTITY_DENSITY_BENCHMARK: float = float(os.getenv("ENTITY_DENSITY_BENCHMARK", "0.206"))

# Answer capsule size
ANSWER_CAPSULE_MIN: int = int(os.getenv("ANSWER_CAPSULE_MIN", "40"))
ANSWER_CAPSULE_MAX: int = int(os.getenv("ANSWER_CAPSULE_MAX", "60"))

# Gemini Grounding (citation verification)
GOOGLE_AI_API_KEY_GROUNDING: str = os.getenv("GOOGLE_AI_API_KEY", "")  # same key, but explicit

# Free tier limits
MAX_QUERIES_FREE: int = int(os.getenv("MAX_QUERIES_FREE", "5"))
MAX_CONTENTS_FREE: int = int(os.getenv("MAX_CONTENTS_FREE", "20"))
```

Mantenere `COVERAGE_THRESHOLD` per backward compatibility ma deprecarlo con un commento.

**Criterio di verifica:** `python -c "from app.config import config; print(config.COVERAGE_EXCELLENT)"` stampa `0.88`.

---

### Task 4.4: Riscrivi fetcher.py — Preserva HTML + estrai schema

**File da toccare:**
- `services/analyzer/app/fetcher.py`

**Cosa fare:** Il fetcher attuale restituisce `html`, `title`, `raw_text`, `word_count`. Deve anche restituire:

- `raw_html`: l'HTML originale NON modificato (per schema check)
- `schema_markup`: lista di JSON-LD trovati nella pagina
- `has_article_schema`, `has_faq_schema`, `has_org_schema`: boolean
- `date_modified_schema`: dateModified dallo schema Article (se presente)
- `robots_txt_blocks`: lista di bot bloccati dal robots.txt del dominio (fetch una volta per dominio, cache in memoria)

Aggiungere una funzione `extract_schema_markup(html: str) -> dict`:
```python
def extract_schema_markup(html: str) -> dict:
    """Extract JSON-LD schema markup from HTML."""
    soup = BeautifulSoup(html, "lxml")
    schemas = []
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string)
            schemas.append(data)
        except (json.JSONDecodeError, TypeError):
            continue
    
    has_article = any(_is_type(s, "Article") for s in schemas)
    has_faq = any(_is_type(s, "FAQPage") for s in schemas)
    has_org = any(_is_type(s, "Organization") for s in schemas)
    
    date_modified = None
    for s in schemas:
        if _is_type(s, "Article") and "dateModified" in s:
            date_modified = s["dateModified"]
            break
    
    return {
        "schemas": schemas,
        "has_article_schema": has_article,
        "has_faq_schema": has_faq,
        "has_org_schema": has_org,
        "date_modified_schema": date_modified,
    }
```

Aggiungere una funzione `check_robots_txt(domain: str) -> list[str]` che fetcha `https://{domain}/robots.txt` e controlla se GPTBot, ClaudeBot, PerplexityBot, Google-Extended sono bloccati (`User-agent: GPTBot\nDisallow: /`).

**Criterio di verifica:** `fetch_url("https://example.com")` restituisce il dict esteso con tutti i nuovi campi. Test con un URL reale che ha schema markup.

---

### Task 4.5: Riscrivi segmenter.py — Aggiungi posizione relativa e segnali euristici

**File da toccare:**
- `services/analyzer/app/segmenter.py`

**Cosa fare:** Il segmenter attuale produce `{passageText, passageIndex, wordCount, heading}`. Deve anche produrre:

- `relative_position: float` — posizione del passaggio nel documento (0.0-1.0). Calcolata come: `character_offset_inizio_passaggio / lunghezza_totale_testo`
- `entity_density: float` — % di token che sono named entities (NER euristico con regex per pattern maiuscoli, numeri con contesto, nomi propri). NON usare un modello NER esterno per ora — troppo pesante. Usare un pattern matching: conta i token che iniziano con maiuscola (escluso inizio frase), nomi di brand noti, acronimi.
- `has_statistics: bool` — il passaggio contiene pattern numerici con contesto: `r'\b\d+[\.,]?\d*\s*(%|percent|million|billion|euro|dollar|\$|€|x\b|times\b)'`
- `has_source_citation: bool` — il passaggio contiene pattern di citazione: `r'(according to|source:|study|research|report|survey|data from|found that|published)'`
- `is_answer_first: bool` — le prime 40-60 parole contengono un Definition Lead pattern. Euristico: la prima frase contiene un verbo "essere/is" entro le prime 15 parole E ha almeno 8 parole.
- `is_question_heading: bool` — il heading associato contiene un `?`

```python
import re

def _calc_entity_density(text: str) -> float:
    """Approximate entity density using capitalization heuristic."""
    words = text.split()
    if not words:
        return 0.0
    
    entity_count = 0
    for i, word in enumerate(words):
        clean = word.strip(".,;:!?\"'()-")
        if not clean:
            continue
        # Skip sentence starters
        if i > 0 and words[i-1][-1] not in '.!?':
            if clean[0].isupper() and len(clean) > 1:
                entity_count += 1
        # Acronyms
        if clean.isupper() and len(clean) >= 2:
            entity_count += 1
    
    return round(entity_count / len(words), 3)

def _has_statistics(text: str) -> bool:
    pattern = r'\b\d+[\.,]?\d*\s*(%|percent|million|billion|miliardi|milioni|euro|dollar|\$|€|×|x\s)'
    return bool(re.search(pattern, text, re.IGNORECASE))

def _has_source_citation(text: str) -> bool:
    patterns = [
        r'according to', r'source:', r'\bstudy\b', r'\bresearch\b',
        r'\breport\b', r'\bsurvey\b', r'data from', r'found that',
        r'published (by|in)', r'secondo', r'fonte:', r'studio\b',
        r'ricerca\b', r'rapporto\b',
    ]
    for p in patterns:
        if re.search(p, text, re.IGNORECASE):
            return True
    return False

def _is_answer_first(text: str) -> bool:
    """Check if first sentence follows Definition Lead pattern."""
    first_sentence = text.split('.')[0] if text else ""
    words = first_sentence.split()
    if len(words) < 8:
        return False
    # Check for "is/are/è" in first 15 words
    first_chunk = ' '.join(words[:15]).lower()
    return any(v in first_chunk for v in [' is ', ' are ', ' was ', ' è ', ' sono '])
```

La funzione `segment_html` deve calcolare tutti questi campi per ogni passaggio e includerli nel dict di output. Anche `relative_position` deve essere calcolato correttamente basandosi sull'offset di caratteri nel testo totale estratto.

**Criterio di verifica:** Eseguire il segmenter su un HTML di test e verificare che i campi aggiuntivi sono presenti e ragionevoli. Un passaggio con "According to Gartner, 73% of enterprises..." deve avere `has_statistics=True` e `has_source_citation=True`.

---

## BLOCCO B — Nuovo scoring engine

### Task 4.6: Riscrivi scoring.py — Fanout query generation (invariato ma pulito)

**File da toccare:**
- `services/analyzer/app/scoring.py`

**Cosa fare:** La generazione fanout resta sostanzialmente invariata. Pulire e migliorare:
1. Aggiungere la categoria `recent` esplicitamente nel prompt (con istruzione di includere l'anno corrente)
2. Aggiungere error handling più robusto
3. Mantenere la struttura async con gather

Il codice attuale è OK — si tratta di small improvements, non riscrittura.

**Criterio di verifica:** La generazione di fanout queries funziona come prima.

---

### Task 4.7: Riscrivi embeddings.py — Coverage a 4 fasce

**File da toccare:**
- `services/analyzer/app/embeddings.py`

**Cosa fare:** La funzione `compute_coverage` attualmente restituisce un singolo ratio (coperto/non coperto con soglia binaria). Riscrivere per supportare 4 fasce:

```python
def compute_coverage_tiered(
    query_embeddings: list[list[float]],
    passage_embeddings: list[list[float]],
    thresholds: dict,  # {"excellent": 0.88, "good": 0.75, "weak": 0.60}
) -> tuple[float, list[dict]]:
    """
    For each query, find best-matching passage and classify into tiers.
    Returns (weighted_score, coverage_map).
    
    Score formula:
    score = (n_excellent × 1.0 + n_good × 0.7 + n_weak × 0.3) / n_total
    """
    coverage_map = []
    tier_counts = {"excellent": 0, "good": 0, "weak": 0, "none": 0}
    
    for q_idx, q_emb in enumerate(query_embeddings):
        best_score = 0.0
        best_passage_idx = -1
        for p_idx, p_emb in enumerate(passage_embeddings):
            sim = cosine_similarity(q_emb, p_emb)
            if sim > best_score:
                best_score = sim
                best_passage_idx = p_idx
        
        if best_score >= thresholds["excellent"]:
            tier = "excellent"
        elif best_score >= thresholds["good"]:
            tier = "good"
        elif best_score >= thresholds["weak"]:
            tier = "weak"
        else:
            tier = "none"
        
        tier_counts[tier] += 1
        coverage_map.append({
            "query_index": q_idx,
            "best_passage_index": best_passage_idx,
            "similarity_score": round(best_score, 4),
            "tier": tier,
        })
    
    total = len(query_embeddings) or 1
    weighted_score = (
        tier_counts["excellent"] * 1.0 +
        tier_counts["good"] * 0.7 +
        tier_counts["weak"] * 0.3
    ) / total
    
    return round(weighted_score, 3), coverage_map
```

Mantenere la vecchia `compute_coverage` come wrapper per backward compatibility nella preview pipeline (che può continuare a usare la versione semplificata).

**Criterio di verifica:** Test con embedding sintetici che verificano le 4 fasce producono score corretti.

---

### Task 4.8: Riscrivi scoring.py — Citation Power score (ex passage quality)

**File da toccare:**
- `services/analyzer/app/scoring.py`

**Cosa fare:** Sostituire completamente `score_passage_quality` con `score_citation_power`. Il nuovo score è **prevalentemente euristico** — NON usa più Claude per il per-passage scoring nella versione base. I sub-criteri euristici calcolati dal segmenter (Task 4.5) sono già disponibili nei passaggi.

```python
def score_citation_power(contents: list[dict]) -> tuple[float, list[dict]]:
    """
    Score citation power for all passages across all contents.
    Sub-criteria weights:
    - position_score: 25%
    - entity_density: 20%
    - statistical_specificity: 20%
    - definiteness: 15%
    - answer_first: 10%
    - source_citation: 10%
    
    Returns (project_score, per_passage_scores)
    """
    all_scored = []
    
    for content in contents:
        for passage in content.get("passages", []):
            pos = passage.get("relative_position", 0.5)
            
            # Position score: first 30% = 1.0, 30-70% = 0.7, last 30% = 0.55
            if pos <= 0.30:
                position_score = 1.0
            elif pos <= 0.70:
                position_score = 0.7
            else:
                position_score = 0.55
            
            # Entity density: normalize against benchmark (0.206)
            ed = passage.get("entity_density", 0.0)
            entity_score = min(ed / config.ENTITY_DENSITY_BENCHMARK, 1.0)
            
            # Statistical specificity
            stat_score = 0.9 if passage.get("has_statistics") else 0.2
            
            # Definiteness (proxy: answer-first + no hedge words)
            def_score = 0.85 if passage.get("is_answer_first") else 0.3
            
            # Answer-first structure
            af_score = 0.9 if passage.get("is_answer_first") else 0.3
            
            # Source citation
            sc_score = 0.9 if passage.get("has_source_citation") else 0.2
            
            overall = (
                position_score * 0.25 +
                entity_score * 0.20 +
                stat_score * 0.20 +
                def_score * 0.15 +
                af_score * 0.10 +
                sc_score * 0.10
            )
            
            all_scored.append({
                **passage,
                "content_id": content["id"],
                "scores": {
                    "position_score": round(position_score, 3),
                    "entity_density": round(entity_score, 3),
                    "statistical_specificity": round(stat_score, 3),
                    "definiteness": round(def_score, 3),
                    "answer_first": round(af_score, 3),
                    "source_citation": round(sc_score, 3),
                },
                "overall_score": round(overall, 3),
            })
    
    if not all_scored:
        return 0.5, []
    
    avg = sum(s["overall_score"] for s in all_scored) / len(all_scored)
    return round(avg, 3), all_scored
```

**Vantaggio enorme**: questo scoring è interamente euristico — ZERO chiamate API. Molto più veloce, molto meno costoso, e più riproducibile della versione precedente con Claude.

Claude Sonnet viene ora usato SOLO per insight e raccomandazioni (dove il reasoning LLM aggiunge valore reale), non per lo scoring dei passaggi.

**Criterio di verifica:** Score calcolato su passaggi di test. Un passaggio con statistiche, citazione a fonte, nel primo 30%, con entity density alta → score > 0.8. Un passaggio vago nell'ultimo terzo senza dati → score < 0.4.

---

### Task 4.9: Riscrivi scoring.py — Entity Authority + Extractability + Source Authority

**File da toccare:**
- `services/analyzer/app/scoring.py`

**Cosa fare:** Riscrivere le tre funzioni di scoring rimanenti.

**Entity Authority** (`score_entity_authority`):
```python
def score_entity_authority(
    contents: list[dict],
    brand_name: str,
    schema_data: dict,  # aggregato da fetcher
    discovery_stats: dict,  # {own_count, mention_count}
) -> float:
    """
    Sub-criteria:
    - kg_presence (30%): Wikidata, Wikipedia, Knowledge Panel (from schema sameAs)
    - cross_web_corroboration (25%): mention_count / (own_count + mention_count)
    - entity_density_avg (20%): media entity density di tutti i passaggi
    - term_consistency (15%): come il vecchio, termini condivisi cross-pagina
    - entity_home_strength (10%): schema Organization + sameAs + About page quality
    """
```

Per `kg_presence`: controllare se lo schema Organization ha `sameAs` links a wikipedia.org, wikidata.org. Se non c'è schema, score = 0 per questo sub-criterio. Se c'è schema con sameAs: 0.5 per ogni link riconosciuto (max 1.0).

Per `cross_web_corroboration`: usare i dati dalla discovery (già disponibili nella tabella `contents` con `contentType = 'mention'`).

Per `entity_home_strength`: verificare la presenza di schema Organization nel sito. Se ha `sameAs` con 3+ link → 1.0. Se ha schema senza sameAs → 0.5. Se non ha schema → 0.2.

**Extractability** (`score_extractability`):
```python
def score_extractability(
    contents: list[dict],
    schema_data: dict,  # aggregato
    robots_blocked: list[str],  # bot bloccati
) -> float:
    """
    Sub-criteria:
    - passage_length (20%): come il vecchio chunkability, finestra 134-167
    - answer_capsule (20%): % sezioni con blocco 40-60 parole dopo H2
    - schema_markup (20%): Article + FAQ + Organization schema presenti
    - heading_structure (15%): heading presenti e formulati come domande
    - ai_crawler_access (15%): nessun bot AI bloccato in robots.txt
    - self_ref_pollution (10%): assenza di "come detto sopra" etc.
    """
```

**Source Authority** (`score_source_authority`):
Come nel documento metodologico, con pesi per piattaforma differenziati in base a `project.aiPlatformTarget`.

**Criterio di verifica:** Ogni funzione produce un float 0.0-1.0. Test con dati mock.

---

### Task 4.10: Riscrivi full_pipeline.py — Integra tutto + freshness + content versioning

**File da toccare:**
- `services/analyzer/app/full_pipeline.py`

**Cosa fare:** Riscrivere `run_full_pipeline` con i nuovi step:

```
0. Auto-fetch unfetched (invariato)
1. Load data (+ schema data dal fetcher)
2. Generate fanout queries (invariato)  
3. Embed + coverage TIERED (nuovo)
4. Citation Power score (nuovo, euristico)
5. Entity Authority score (nuovo)
6. Extractability score (nuovo, include schema check)
7. Source Authority score (aggiornato)
8. Freshness multiplier (nuovo)
9. Composite AI Readiness Score (nuovi pesi)
10. Insights + recommendations (aggiornato con nuovi score names)
11. Citation verification via Gemini Grounding (nuovo)
12. Content versioning (nuovo - salva snapshot per before/after)
13. Persist (aggiornato con nuove tabelle)
```

**Step 8 — Freshness multiplier:**
```python
def _compute_freshness_multiplier(contents: list[dict]) -> float:
    """Compute project-level freshness multiplier."""
    multipliers = []
    now = datetime.utcnow()
    for content in contents:
        # Use schema dateModified if available, else lastFetchedAt
        modified = content.get("date_modified_schema") or content.get("lastFetchedAt")
        if not modified:
            multipliers.append(config.FRESHNESS_NEUTRAL)
            continue
        
        if isinstance(modified, str):
            modified = datetime.fromisoformat(modified.replace("Z", "+00:00"))
        
        days_old = (now - modified.replace(tzinfo=None)).days
        
        if days_old < 30:
            multipliers.append(config.FRESHNESS_BOOST_30D)
        elif days_old < 60:
            multipliers.append(config.FRESHNESS_NEUTRAL)
        elif days_old < 120:
            multipliers.append(config.FRESHNESS_DECAY_120D)
        else:
            multipliers.append(config.FRESHNESS_PENALTY)
    
    return round(sum(multipliers) / len(multipliers), 3) if multipliers else 1.0
```

**Step 12 — Content versioning:**
Per ogni contenuto, salvare un hash del testo. Al prossimo ciclo, confrontare l'hash per rilevare modifiche. Se modificato, salvare il delta nel record `ContentVersion`.

**Criterio di verifica:** La pipeline completa gira senza errori su un progetto di test. I nuovi score vengono salvati correttamente nello snapshot. La citation verification produce risultati (o fallisce gracefully se la API key non è configurata).

---

## BLOCCO C — Citation verification + UI

### Task 4.11: Implementa Citation Verification (Gemini Grounding)

**File da creare:**
- `services/analyzer/app/citation_check.py`

**Cosa fare:** Creare un modulo che per ogni query target:

1. Chiama Gemini API con `google_search` tool abilitato
2. Raccoglie `groundingMetadata` dalla risposta
3. Estrae le fonti citate (`groundingChunks`)
4. Per ogni fonte, verifica se il dominio corrisponde al sito dell'utente
5. Salva il risultato nella tabella `CitationCheck`

```python
async def check_citations(
    target_queries: list[dict],
    user_domain: str,
    project_id: str,
) -> list[dict]:
    """
    For each target query, ask Gemini with grounding and check if user is cited.
    """
    results = []
    
    for tq in target_queries:
        query_text = tq["queryText"]
        
        response = await _gemini_client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=query_text,
            config={
                "tools": [{"google_search": {}}],
            }
        )
        
        # Extract grounding metadata
        cited_sources = []
        grounding = getattr(response.candidates[0], 'grounding_metadata', None)
        if grounding and grounding.grounding_chunks:
            for chunk in grounding.grounding_chunks:
                web = getattr(chunk, 'web', None)
                if web:
                    domain = extract_domain(web.uri)
                    cited_sources.append({
                        "url": web.uri,
                        "title": web.title,
                        "domain": domain,
                        "is_user": domain == user_domain,
                    })
        
        user_cited = any(s["is_user"] for s in cited_sources)
        
        results.append({
            "target_query_id": tq["id"],
            "cited_sources": cited_sources,
            "user_cited": user_cited,
            "search_queries": getattr(grounding, 'web_search_queries', []) if grounding else [],
        })
    
    return results
```

**NOTA IMPORTANTE**: la API Gemini con Grounding usa il parametro `tools` con `google_search`. Controllare la documentazione più recente di google-genai SDK per la sintassi esatta. L'URL di riferimento è: https://ai.google.dev/gemini-api/docs/google-search

**Criterio di verifica:** Per una query di test (es: "best CRM for startups"), la funzione restituisce una lista di fonti citate con URL e titoli. Il campo `user_cited` è corretto.

---

### Task 4.12: Implementa Competitor Citation Analysis

**File da creare:**
- `services/analyzer/app/competitor_analysis.py`

**Cosa fare:** Per ogni fonte citata nella citation verification che NON è dell'utente:

1. Fetch della pagina citata
2. Segmenta con il segmenter aggiornato (che ora include entity_density, has_statistics, etc.)
3. Calcola il Citation Power score del contenuto competitor
4. Genera un "gap report" confrontando con il contenuto dell'utente più vicino per quella query

Il gap report è un dict strutturato:
```python
{
    "competitor_url": "...",
    "competitor_domain": "...",
    "query": "...",
    "competitor_metrics": {
        "entity_density": 0.22,
        "has_statistics": True,
        "has_schema_article": True,
        "freshness_days": 8,
        "heading_is_question": True,
        "answer_capsule_present": True,
    },
    "user_metrics": {  # dal contenuto utente più vicino
        "entity_density": 0.08,
        "has_statistics": False,
        "has_schema_article": False,
        "freshness_days": 94,
        "heading_is_question": False,
        "answer_capsule_present": False,
    },
    "gaps": [
        "Missing statistics with attribution",
        "No Article schema markup",
        "Content not updated in 94 days",
        "No answer capsule after heading",
    ],
}
```

Salvare i risultati nella tabella `competitor_contents` (già esistente nello schema) con i dati arricchiti.

**Criterio di verifica:** Per una citation check che restituisce competitor, il gap report viene generato con dati reali.

---

### Task 4.13: Aggiorna pipeline.py (preview) con i nuovi score

**File da toccare:**
- `services/analyzer/app/pipeline.py`

**Cosa fare:** La preview pipeline deve usare i nuovi nomi di score e i nuovi sub-criteri euristici. NON aggiungere citation verification alla preview (troppo lenta per i 30-60 secondi target).

Aggiornare:
- I nomi dei score nel dict di ritorno
- Usare `score_citation_power` al posto di `score_passage_quality`
- Usare `score_extractability` al posto di `score_chunkability`
- Usare `score_entity_authority` al posto di `score_entity_coherence`
- Usare `score_source_authority` al posto di `score_cross_platform`
- I pesi nel `compute_ai_readiness` aggiornati

**Criterio di verifica:** La preview pipeline funziona con i nuovi score. L'output ha i nuovi nomi.

---

### Task 4.14: Aggiorna i18n e UI per i nuovi score names

**File da toccare:**
- `apps/web/messages/en.json`
- `apps/web/messages/it.json`
- Tutti i componenti che referenziano i vecchi nomi di score

**Cosa fare:**

1. In `en.json` e `it.json`, aggiornare:
   - `scores.answerStrength` → `scores.citationPower` (label: "Citation Power")
   - `scores.brandTrust` → `scores.brandAuthority` (label: "Brand Authority")
   - Aggiungere descrizioni per i nuovi sub-criteri

2. Cercare in tutti i file TypeScript/TSX i riferimenti ai vecchi nomi di campo:
   - `passageQualityScore` → `citationPowerScore`
   - `entityCoherenceScore` → `entityAuthorityScore`
   - `chunkabilityScore` → `extractabilityScore`
   - `crossPlatformScore` → `sourceAuthorityScore`
   - `selfContainedness` → `positionScore`
   - `claimClarity` → `entityDensity`
   - `informationDensity` → `statisticalSpecificity`
   - `completeness` → `definiteness`
   - `verifiability` → `sourceCitation`

Usare un grep ricorsivo per trovare tutti i riferimenti.

**Criterio di verifica:** L'app compila senza errori TypeScript. I nuovi nomi appaiono nelle pagine Overview, Content Detail, Opportunity Map.

---

### Task 4.15: Aggiorna CLAUDE.md — Fase 4 completa

**File da toccare:**
- `CLAUDE.md`

**Cosa fare:** Aggiornare lo stato della Fase 4 come COMPLETE. Compattare i task in formato tabellare come le fasi precedenti.

Aggiornare la sezione "Score naming" con la versione definitiva.

Aggiungere note su:
- Il scoring è ora prevalentemente euristico (no Claude per passage scoring)
- La citation verification usa Gemini Grounding
- Il fetcher preserva HTML originale per schema check
- Free tier limits sono nel config

---

## Note per Claude Code

### Ordine di esecuzione
I task DEVONO essere eseguiti in ordine. Ogni task dipende dal precedente.
**Eccezione**: Task 4.0 (Discovery) è indipendente dal resto e può essere testato immediatamente con dati reali. Eseguilo PRIMA di tutto il resto — se la discovery non funziona bene, il resto del refactoring perde di significato.

### Testing
Dopo ogni task, verificare che:
1. La migration Prisma funziona (`npx prisma migrate dev`)
2. Il server Python parte (`uvicorn app.main:app --reload`)
3. Il server Next.js parte (`npm run dev`)
4. Non ci sono errori TypeScript (`npx tsc --noEmit`)

**Per Task 4.0 specificamente**: testare con il brand "Marino Allestimenti" (marinoallestimenti.com) e query target tipo "allestimenti per eventi", "stand fieristici". Verificare che la query `intitle:` trova articoli press/blog.

### Rollback
Se un task fallisce, NON procedere al successivo. Fixare il task corrente prima.

### Costi API
Il nuovo scoring engine NON usa Claude per il passage scoring (era il costo più alto). Claude viene usato solo per insight e raccomandazioni. Gemini viene usato per fanout (come prima) + Grounding (nuovo). Voyage AI per embedding (come prima).

### Bug noto
Il README riporta un bug: "fanout_coverage_score always 0". Questo potrebbe essere un problema con Voyage AI embeddings. Durante il refactoring, verificare che gli embedding vengono generati correttamente e che i vettori non sono tutti zeri.
