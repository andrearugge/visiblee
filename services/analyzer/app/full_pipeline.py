from __future__ import annotations

"""
Full project scoring pipeline (v2).

Steps:
 0. Auto-fetch unfetched confirmed content (save rawHtml, schema, heuristic signals)
 1. Load project data, target queries, confirmed passages from DB
 2. Generate fanout queries (Gemini)
 3. Embed + tiered coverage score (Voyage AI, 4-tier)
 4. Citation Power score (heuristic — zero LLM)
 5. Entity Authority score (heuristic)
 6. Extractability score (heuristic + schema check)
 7. Source Authority score (heuristic)
 8. Freshness multiplier
 9. Composite AI Readiness Score
10. Insights + recommendations (Claude/Gemini)
11. Content versioning (hash-based change detection)
12. Persist snapshot, passage scores, coverage map
"""

import asyncio
import hashlib
import json
import logging
import time
from typing import Any

from .config import config
from .embeddings import embed_texts, compute_coverage_tiered
from .fetcher import fetch_url
from .segmenter import segment_html
from .scoring import (
    generate_fanout_queries,
    generate_fanout_queries_grouped,
    score_citation_power,
    score_entity_authority,
    score_extractability,
    score_source_authority,
    compute_freshness_multiplier,
    compute_ai_readiness,
    generate_insights,
)
from .recommendations import generate_recommendations, save_recommendations
from .citation_check import check_citations, save_citation_checks, _extract_domain
from .competitor_analysis import analyze_competitor_citations

log = logging.getLogger(__name__)

KNOWN_PLATFORMS = ["website", "linkedin", "reddit", "medium", "youtube", "substack", "news", "other"]


# ── Embedding cache helpers ───────────────────────────────────────────────────

def _parse_vector(v) -> list[float] | None:
    """Parse pgvector string '[x1,x2,...]' returned by psycopg2 → list[float]."""
    if v is None:
        return None
    if isinstance(v, list):
        return v
    s = str(v).strip()
    if s.startswith('[') and s.endswith(']'):
        try:
            return [float(x) for x in s[1:-1].split(',')]
        except ValueError:
            return None
    return None


def _format_vector(v: list[float]) -> str:
    """Format list[float] as pgvector literal '[x1,x2,...]'."""
    return '[' + ','.join(repr(x) for x in v) + ']'


def _is_zero_vector(v: list[float] | None) -> bool:
    """Return True for null or all-zero vectors (Voyage AI unavailable fallback)."""
    return v is None or all(x == 0.0 for x in v)


def _save_passage_embeddings(conn, items: list[tuple[str, list[float]]]) -> None:
    """Persist computed passage embeddings back to DB."""
    if not items:
        return
    with conn.cursor() as cur:
        for passage_id, emb in items:
            cur.execute(
                'UPDATE passages SET embedding = %s::vector WHERE id = %s',
                (_format_vector(emb), passage_id),
            )
    conn.commit()


def _load_fanout_emb_cache(conn, project_id: str) -> dict[str, list[float]]:
    """Return {queryText: embedding} for fanout_queries of this project that have a cached embedding."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT fq."queryText", fq.embedding::text
            FROM fanout_queries fq
            JOIN target_queries tq ON tq.id = fq."targetQueryId"
            WHERE tq."projectId" = %s
              AND fq.embedding IS NOT NULL
            """,
            (project_id,),
        )
        rows = cur.fetchall()
    cache: dict[str, list[float]] = {}
    for row in rows:
        emb = _parse_vector(row["embedding"])
        if emb and not _is_zero_vector(emb):
            cache[row["queryText"]] = emb
    return cache


def _update_fanout_query_embeddings(
    conn,
    fanout_query_ids: list[str],
    fanout_flat: list[str],
    emb_cache: dict[str, list[float]],
) -> None:
    """Persist query embeddings on the newly inserted fanout_queries rows."""
    if not fanout_query_ids:
        return
    with conn.cursor() as cur:
        for fq_id, text in zip(fanout_query_ids, fanout_flat):
            emb = emb_cache.get(text)
            if emb and not _is_zero_vector(emb):
                cur.execute(
                    'UPDATE fanout_queries SET embedding = %s::vector WHERE id = %s',
                    (_format_vector(emb), fq_id),
                )
    conn.commit()


# ── DB helpers ────────────────────────────────────────────────────────────────

def _load_project(conn, project_id: str) -> dict | None:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT p."websiteUrl", p."brandName", p."aiPlatformTarget",
                   p."targetLanguage", p."targetCountry",
                   u."preferredLocale"
            FROM projects p
            JOIN users u ON u.id = p."userId"
            WHERE p.id = %s
            """,
            (project_id,),
        )
        return cur.fetchone()


def _load_target_queries(conn, project_id: str) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(
            'SELECT id, "queryText" FROM target_queries WHERE "projectId" = %s AND "isActive" = true',
            (project_id,),
        )
        return [{"id": r["id"], "queryText": r["queryText"]} for r in cur.fetchall()]


def _load_contents_with_passages(conn, project_id: str) -> list[dict]:
    """Return confirmed+fetched contents with passages including v2 heuristic fields."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, url, title, platform, "contentType", "wordCount",
                   "lastFetchedAt", "schemaMarkup", "hasArticleSchema",
                   "hasFaqSchema", "hasOrgSchema", "dateModifiedSchema", "lastContentHash"
            FROM contents
            WHERE "projectId" = %s
              AND "isConfirmed" = true
              AND "lastFetchedAt" IS NOT NULL
            """,
            (project_id,),
        )
        contents = [dict(r) for r in cur.fetchall()]

    for content in contents:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, "passageText", "passageIndex", "wordCount", heading,
                       "relativePosition", "entityDensity", "hasStatistics",
                       "hasSourceCitation", "isAnswerFirst",
                       embedding::text AS embedding
                FROM passages
                WHERE "contentId" = %s
                ORDER BY "passageIndex"
                """,
                (content["id"],),
            )
            content["passages"] = [
                {
                    "id": r["id"],
                    "passageText": r["passageText"],
                    "passage_text": r["passageText"],
                    "passageIndex": r["passageIndex"],
                    "wordCount": r["wordCount"] or 0,
                    "word_count": r["wordCount"] or 0,
                    "heading": r["heading"],
                    "relativePosition": float(r["relativePosition"]) if r["relativePosition"] is not None else 0.5,
                    "entityDensity": float(r["entityDensity"]) if r["entityDensity"] is not None else 0.0,
                    "hasStatistics": bool(r["hasStatistics"]),
                    "hasSourceCitation": bool(r["hasSourceCitation"]),
                    "isAnswerFirst": bool(r["isAnswerFirst"]),
                    "embedding": _parse_vector(r["embedding"]),
                }
                for r in cur.fetchall()
            ]

    return contents


def _load_confirmed_platforms(conn, project_id: str) -> dict[str, list[str]]:
    with conn.cursor() as cur:
        cur.execute(
            'SELECT platform, url FROM contents WHERE "projectId" = %s AND "isConfirmed" = true',
            (project_id,),
        )
        result: dict[str, list[str]] = {p: [] for p in KNOWN_PLATFORMS}
        for r in cur.fetchall():
            plat = r["platform"]
            if plat in result:
                result[plat].append(r["url"])
        return result


def _load_discovery_stats(conn, project_id: str) -> dict[str, int]:
    """Return own_count and mention_count from confirmed contents."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT "contentType", COUNT(*) as cnt
            FROM contents
            WHERE "projectId" = %s AND "isConfirmed" = true
            GROUP BY "contentType"
            """,
            (project_id,),
        )
        stats: dict[str, int] = {"own_count": 0, "mention_count": 0}
        for r in cur.fetchall():
            if r["contentType"] == "own":
                stats["own_count"] = r["cnt"]
            elif r["contentType"] == "mention":
                stats["mention_count"] = r["cnt"]
        return stats


# ── Auto-fetch unfetched content ──────────────────────────────────────────────

async def _auto_fetch_unfetched(conn, project_id: str) -> None:
    """
    Fetch and segment any confirmed content that hasn't been fetched yet.
    Saves rawHtml, schema markup, heuristic signals, and passage records.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, url FROM contents
            WHERE "projectId" = %s
              AND "isConfirmed" = true
              AND "lastFetchedAt" IS NULL
            """,
            (project_id,),
        )
        unfetched = [dict(r) for r in cur.fetchall()]

    if not unfetched:
        return

    log.info(f"[{project_id}] Auto-fetching {len(unfetched)} unfetched contents")

    for content in unfetched:
        cid = content["id"]
        url = content["url"]
        result = await fetch_url(url)
        if not result:
            log.warning(f"[{project_id}] Fetch failed for {url} — skipping")
            continue

        passages = segment_html(result["html"])
        if not passages:
            log.warning(f"[{project_id}] No passages extracted from {url} — skipping")
            continue

        content_hash = hashlib.sha256(result["raw_text"].encode()).hexdigest()

        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE contents
                SET title = COALESCE(title, %s),
                    "wordCount" = %s,
                    "rawText" = %s,
                    "rawHtml" = %s,
                    "schemaMarkup" = %s,
                    "hasArticleSchema" = %s,
                    "hasFaqSchema" = %s,
                    "hasOrgSchema" = %s,
                    "dateModifiedSchema" = %s,
                    "lastContentHash" = %s,
                    "lastFetchedAt" = NOW()
                WHERE id = %s
                """,
                (
                    result["title"],
                    result["word_count"],
                    result["raw_text"],
                    result["raw_html"],
                    json.dumps(result.get("schema_markup", [])),
                    result.get("has_article_schema", False),
                    result.get("has_faq_schema", False),
                    result.get("has_org_schema", False),
                    result.get("date_modified_schema"),
                    content_hash,
                    cid,
                ),
            )
            cur.execute('DELETE FROM passages WHERE "contentId" = %s', (cid,))
            for p in passages:
                cur.execute(
                    """
                    INSERT INTO passages (
                        id, "contentId", "passageText", "passageIndex", "wordCount", heading,
                        "relativePosition", "entityDensity", "hasStatistics",
                        "hasSourceCitation", "isAnswerFirst", "createdAt"
                    )
                    VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                    """,
                    (
                        cid,
                        p["passageText"],
                        p["passageIndex"],
                        p["wordCount"],
                        p.get("heading"),
                        p.get("relativePosition"),
                        p.get("entityDensity"),
                        p.get("hasStatistics", False),
                        p.get("hasSourceCitation", False),
                        p.get("isAnswerFirst", False),
                    ),
                )

        conn.commit()
        log.info(f"[{project_id}] Fetched {url}: {len(passages)} passages")


# ── Save results ──────────────────────────────────────────────────────────────

def _save_fanout_queries(
    conn,
    target_queries: list[dict],
    fanout_grouped: list[list[dict]],
    batch_id: str,
) -> list[str]:
    fanout_query_ids: list[str] = []
    with conn.cursor() as cur:
        for target, fanout_items in zip(target_queries, fanout_grouped):
            for item in fanout_items:
                cur.execute(
                    """
                    INSERT INTO fanout_queries (id, "targetQueryId", "queryText", "queryType", "batchId", "generatedAt")
                    VALUES (gen_random_uuid(), %s, %s, %s, %s, NOW())
                    RETURNING id
                    """,
                    (target["id"], item["text"], item["type"], batch_id),
                )
                fanout_query_ids.append(cur.fetchone()["id"])
    return fanout_query_ids


def _save_fanout_coverage_map(
    conn,
    fanout_query_ids: list[str],
    coverage_entries: list[dict],
    all_passages: list[dict],
) -> None:
    with conn.cursor() as cur:
        for fq_id, entry in zip(fanout_query_ids, coverage_entries):
            p_idx = entry["best_passage_index"]
            if p_idx < 0 or p_idx >= len(all_passages):
                continue
            passage_id = all_passages[p_idx]["id"]
            cur.execute(
                """
                INSERT INTO fanout_coverage_map (
                    id, "fanoutQueryId", "passageId",
                    "similarityScore", "isCovered", "coverageTier", "createdAt"
                )
                VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, NOW())
                """,
                (
                    fq_id, passage_id,
                    entry["similarity_score"],
                    entry["is_covered"],
                    entry.get("coverage_tier", "none"),
                ),
            )


def _save_snapshot(conn, project_id: str, scores: dict[str, float], metadata: dict) -> str:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO project_score_snapshots (
                id, "projectId", "snapshotType",
                "aiReadinessScore", "fanoutCoverageScore", "citationPowerScore",
                "extractabilityScore", "entityAuthorityScore", "sourceAuthorityScore",
                metadata, "createdAt"
            )
            VALUES (
                gen_random_uuid(), %s, 'manual',
                %s, %s, %s, %s, %s, %s,
                %s, NOW()
            )
            RETURNING id
            """,
            (
                project_id,
                scores["ai_readiness_score"],
                scores["fanout_coverage_score"],
                scores["citation_power_score"],
                scores["extractability_score"],
                scores["entity_authority_score"],
                scores["source_authority_score"],
                json.dumps(metadata),
            ),
        )
        return cur.fetchone()["id"]


def _save_passage_scores(conn, snapshot_id: str, scored_passages: list[dict]) -> dict[str, str]:
    """Insert PassageScore rows with v2 heuristic sub-criteria. Returns {passage_id: score_id}."""
    id_map: dict[str, str] = {}
    with conn.cursor() as cur:
        for sp in scored_passages:
            passage_id = sp.get("id")
            if not passage_id:
                continue
            criteria = sp.get("scores", {})
            cur.execute(
                """
                INSERT INTO passage_scores (
                    id, "passageId", "snapshotId",
                    "positionScore", "entityDensity", "statisticalSpecificity",
                    "definiteness", "answerFirst", "sourceCitation",
                    "overallScore", "createdAt"
                )
                VALUES (
                    gen_random_uuid(), %s, %s,
                    %s, %s, %s, %s, %s, %s, %s,
                    NOW()
                )
                RETURNING id
                """,
                (
                    passage_id,
                    snapshot_id,
                    criteria.get("position_score"),
                    criteria.get("entity_density"),
                    criteria.get("statistical_specificity"),
                    criteria.get("definiteness"),
                    criteria.get("answer_first"),
                    criteria.get("source_citation"),
                    sp.get("overall_score"),
                ),
            )
            id_map[passage_id] = cur.fetchone()["id"]
    return id_map


def _save_content_scores(
    conn,
    snapshot_id: str,
    contents: list[dict],
    scored_passages: list[dict],
    passage_score_ids: dict[str, str],
) -> None:
    passage_scores_by_id = {sp["id"]: sp["overall_score"] for sp in scored_passages if sp.get("id")}

    with conn.cursor() as cur:
        for content in contents:
            passages = content.get("passages", [])
            if not passages:
                continue

            p_scores = [passage_scores_by_id[p["id"]] for p in passages if p["id"] in passage_scores_by_id]
            overall = round(sum(p_scores) / len(p_scores), 3) if p_scores else 0.5

            weakest_id = None
            if p_scores:
                weakest = min(
                    (p for p in passages if p["id"] in passage_scores_by_id),
                    key=lambda p: passage_scores_by_id[p["id"]],
                    default=None,
                )
                weakest_id = weakest["id"] if weakest else None

            cur.execute(
                """
                INSERT INTO content_scores (
                    id, "contentId", "snapshotId",
                    "overallScore", "citationPowerScore",
                    "weakestPassageId", "createdAt"
                )
                VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, NOW())
                """,
                (content["id"], snapshot_id, overall, overall, weakest_id),
            )


def _save_content_versions(
    conn,
    snapshot_id: str,
    contents: list[dict],
    scored_passages: list[dict],
) -> None:
    """Save ContentVersion records for before/after comparison."""
    scored_by_id = {sp["id"]: sp for sp in scored_passages if sp.get("id")}
    with conn.cursor() as cur:
        for content in contents:
            raw_text = content.get("rawText", "") or ""
            content_hash = hashlib.sha256(raw_text.encode()).hexdigest()
            passage_data = [
                {
                    "id": p["id"],
                    "passageIndex": p.get("passageIndex"),
                    "overallScore": scored_by_id.get(p["id"], {}).get("overall_score"),
                }
                for p in content.get("passages", [])
            ]
            cur.execute(
                """
                INSERT INTO content_versions (id, "contentId", "snapshotId", "passageData", "contentHash", "createdAt")
                VALUES (gen_random_uuid(), %s, %s, %s, %s, NOW())
                """,
                (content["id"], snapshot_id, json.dumps(passage_data), content_hash),
            )


# ── Aggregate schema data across all contents ─────────────────────────────────

def _aggregate_schema_data(contents: list[dict]) -> dict[str, Any]:
    """Merge schema data from all contents for entity/extractability scoring."""
    schemas: list[dict] = []
    has_article = False
    has_faq = False
    has_org = False

    for content in contents:
        raw = content.get("schemaMarkup")
        if isinstance(raw, list):
            schemas.extend(raw)
        elif isinstance(raw, str):
            try:
                parsed = json.loads(raw)
                if isinstance(parsed, list):
                    schemas.extend(parsed)
            except Exception:
                pass
        has_article = has_article or bool(content.get("hasArticleSchema"))
        has_faq = has_faq or bool(content.get("hasFaqSchema"))
        has_org = has_org or bool(content.get("hasOrgSchema"))

    return {
        "schemas": schemas,
        "has_article_schema": has_article,
        "has_faq_schema": has_faq,
        "has_org_schema": has_org,
    }


# ── Preview pipeline (stateless — no DB, no caching) ─────────────────────────

async def run_preview_pipeline(
    website_url: str,
    brand_name: str,
    query_targets: list[str],
    language: str = "en",
) -> dict[str, Any]:
    """
    Stateless preview pipeline. Crawls the website, scores with the same
    v2 heuristics and 4-tier coverage as the full pipeline, returns result
    without writing to DB. Target latency: <60s.
    """
    from .crawler import crawl_website, search_cross_platform

    start = time.monotonic()

    crawl_task = asyncio.create_task(crawl_website(website_url))
    cross_platform_task = asyncio.create_task(search_cross_platform(brand_name))
    pages, platform_results = await asyncio.gather(crawl_task, cross_platform_task)

    contents_found = len(pages)
    all_passages = [p for page in pages for p in page.get("passages", [])]

    # Normalise crawler page format for v2 scorers
    contents = [
        {
            "id": None,
            "lastFetchedAt": None,
            "schemaMarkup": None,
            "hasArticleSchema": False,
            "hasFaqSchema": False,
            "hasOrgSchema": False,
            "passages": [
                {
                    **p,
                    "passageText": p.get("passage_text", ""),
                    "wordCount": p.get("word_count", 0),
                    "relativePosition": p.get("relativePosition") or p.get("relative_position", 0.5),
                    "entityDensity": p.get("entityDensity") or p.get("entity_density", 0.0),
                    "hasStatistics": p.get("hasStatistics") or p.get("has_statistics", False),
                    "hasSourceCitation": p.get("hasSourceCitation") or p.get("has_source_citation", False),
                    "isAnswerFirst": p.get("isAnswerFirst") or p.get("is_answer_first", False),
                }
                for p in page.get("passages", [])
            ],
        }
        for page in pages
    ]

    fanout_task = asyncio.create_task(
        generate_fanout_queries(query_targets, brand_name, language)
    )

    citation_power, _ = score_citation_power(contents, language=language)
    entity_authority = score_entity_authority(contents, brand_name)
    extractability = score_extractability(contents)
    source_authority = score_source_authority(platform_results)
    freshness = compute_freshness_multiplier(contents)

    fanout_flat = await fanout_task
    all_queries = query_targets + fanout_flat

    passage_texts = [p["passage_text"][:500] for p in all_passages]
    if passage_texts and all_queries:
        q_embs, p_embs = await asyncio.gather(
            embed_texts(all_queries, input_type="query"),
            embed_texts(passage_texts, input_type="document"),
        )
        fanout_coverage, coverage_map = compute_coverage_tiered(q_embs, p_embs)
    else:
        fanout_coverage = 0.0
        coverage_map = []

    sub_scores = {
        "fanout_coverage_score":  fanout_coverage,
        "citation_power_score":   citation_power,
        "entity_authority_score": entity_authority,
        "extractability_score":   extractability,
        "source_authority_score": source_authority,
    }
    ai_readiness = compute_ai_readiness(sub_scores, freshness_multiplier=freshness)
    all_scores = {"ai_readiness_score": ai_readiness, **sub_scores}

    insights = await generate_insights(brand_name, all_scores, language)

    elapsed = round(time.monotonic() - start, 2)

    return {
        "scores": all_scores,
        "insights": insights,
        "contents_found": contents_found,
        "analysis_data": {
            "elapsed_seconds": elapsed,
            "fanout_queries_count": len(fanout_flat),
            "passages_count": len(all_passages),
            "coverage_map": coverage_map[:50],
            "platform_results": {k: len(v) for k, v in platform_results.items()},
            "pages": [
                {"url": p["url"], "title": p.get("title"), "word_count": p.get("word_count", 0)}
                for p in pages
            ],
        },
    }


# ── Main pipeline ─────────────────────────────────────────────────────────────

async def run_full_pipeline(conn, project_id: str) -> dict[str, Any]:
    start = time.monotonic()

    # 0. Auto-fetch confirmed content not yet fetched
    await _auto_fetch_unfetched(conn, project_id)

    # 1. Load data
    project = _load_project(conn, project_id)
    if not project:
        raise ValueError(f"Project {project_id} not found")

    brand_name: str = project["brandName"]
    language: str = project["targetLanguage"] or project["preferredLocale"] or "en"
    target_country: str = project["targetCountry"] or "US"
    ai_platform_target: str = project.get("aiPlatformTarget") or "all"

    target_queries = _load_target_queries(conn, project_id)
    contents = _load_contents_with_passages(conn, project_id)
    platform_results = _load_confirmed_platforms(conn, project_id)
    discovery_stats = _load_discovery_stats(conn, project_id)

    if not contents:
        raise ValueError("No confirmed+fetched content found — confirm and fetch content first")

    all_passages = [p for c in contents for p in c["passages"]]
    schema_data = _aggregate_schema_data(contents)

    log.info(
        f"[{project_id}] Loaded {len(contents)} contents, "
        f"{len(all_passages)} passages, {len(target_queries)} queries"
    )

    # 2. Fanout queries
    fallback_targets = target_queries or [{"id": None, "queryText": "what is " + brand_name}]
    target_texts = [t["queryText"] for t in fallback_targets]
    fanout_task = asyncio.create_task(
        generate_fanout_queries_grouped(target_texts, brand_name, language)
    )

    # 4–7. Heuristic scores (synchronous, zero LLM calls)
    citation_power, scored_passages = score_citation_power(contents, language=language)
    entity_authority = score_entity_authority(
        contents, brand_name,
        schema_data=schema_data,
        discovery_stats=discovery_stats,
    )
    extractability = score_extractability(contents, schema_data=schema_data)
    source_authority = score_source_authority(platform_results, ai_platform_target=ai_platform_target)

    log.info(
        f"[{project_id}] Heuristic scores — "
        f"citation_power={citation_power:.3f} entity_authority={entity_authority:.3f} "
        f"extractability={extractability:.3f} source_authority={source_authority:.3f}"
    )

    # Await fanout queries
    fanout_grouped = await fanout_task
    fanout_flat = [item["text"] for group in fanout_grouped for item in group]
    all_queries = target_texts + fanout_flat
    log.info(f"[{project_id}] Generated {len(fanout_flat)} fanout queries")

    # 3. Embed + 4-tier tiered coverage (with caching)
    coverage_map: list[dict] = []
    fanout_coverage = 0.0

    # Load fanout embedding cache keyed by queryText
    fanout_emb_cache = _load_fanout_emb_cache(conn, project_id)

    # Split passages into cached vs uncached
    uncached_p_indices = [
        i for i, p in enumerate(all_passages)
        if _is_zero_vector(_parse_vector(p.get("embedding")))
    ]
    cached_p_count = len(all_passages) - len(uncached_p_indices)

    # Split queries into cached vs uncached
    uncached_q_indices = [i for i, t in enumerate(all_queries) if t not in fanout_emb_cache]
    cached_q_count = len(all_queries) - len(uncached_q_indices)

    # Embed uncached passages and uncached queries in parallel
    async def _embed_or_empty(texts: list[str], input_type: str) -> list[list[float]]:
        return await embed_texts(texts, input_type=input_type) if texts else []

    uncached_p_texts = [all_passages[i]["passageText"][:500] for i in uncached_p_indices]
    uncached_q_texts = [all_queries[i] for i in uncached_q_indices]

    new_p_embs, new_q_embs = await asyncio.gather(
        _embed_or_empty(uncached_p_texts, "document"),
        _embed_or_empty(uncached_q_texts, "query"),
    )

    # Fill passage embeddings, save new ones to DB
    if uncached_p_indices and new_p_embs:
        to_save = []
        for idx, emb in zip(uncached_p_indices, new_p_embs):
            all_passages[idx]["embedding"] = emb
            if not _is_zero_vector(emb):
                to_save.append((all_passages[idx]["id"], emb))
        if to_save:
            _save_passage_embeddings(conn, to_save)

    # Fill query embedding cache with newly computed embeddings
    if uncached_q_indices and new_q_embs:
        for idx, emb in zip(uncached_q_indices, new_q_embs):
            fanout_emb_cache[all_queries[idx]] = emb

    log.info(
        f"[{project_id}] Embeddings — passages cached={cached_p_count} "
        f"computed={len(uncached_p_indices)}, queries cached={cached_q_count} "
        f"computed={len(uncached_q_indices)}"
    )

    p_embs = [p.get("embedding") or [0.0] * 1024 for p in all_passages]
    q_embs = [fanout_emb_cache.get(t) or [0.0] * 1024 for t in all_queries]

    if p_embs and q_embs and all_passages:
        fanout_coverage, coverage_map = compute_coverage_tiered(q_embs, p_embs)
        if coverage_map:
            tier_counts: dict[str, int] = {}
            for e in coverage_map:
                tier_counts[e["tier"]] = tier_counts.get(e["tier"], 0) + 1
            max_sim = max(e["similarity_score"] for e in coverage_map)
            log.info(
                f"[{project_id}] Coverage score={fanout_coverage:.3f} "
                f"tiers={tier_counts} max_sim={max_sim:.3f}"
            )
    else:
        log.warning(f"[{project_id}] Skipping fanout coverage: no passages or queries")

    # 8. Freshness multiplier
    freshness = compute_freshness_multiplier(contents)
    log.info(f"[{project_id}] Freshness multiplier: {freshness}")

    # 9. Composite AI Readiness Score
    sub_scores = {
        "fanout_coverage_score":  fanout_coverage,
        "citation_power_score":   citation_power,
        "entity_authority_score": entity_authority,
        "extractability_score":   extractability,
        "source_authority_score": source_authority,
    }
    ai_readiness = compute_ai_readiness(sub_scores, freshness_multiplier=freshness)
    all_scores = {"ai_readiness_score": ai_readiness, **sub_scores}

    # 10. Insights + recommendations (parallel LLM calls)
    insights, recommendations = await asyncio.gather(
        generate_insights(brand_name, all_scores, language),
        generate_recommendations(brand_name, all_scores, language),
    )

    elapsed = round(time.monotonic() - start, 2)
    log.info(f"[{project_id}] Scoring done in {elapsed}s — AI Readiness: {ai_readiness:.1%}")

    metadata = {
        "elapsed_seconds": elapsed,
        "contents_count": len(contents),
        "passages_count": len(all_passages),
        "fanout_queries_count": len(fanout_flat),
        "freshness_multiplier": freshness,
        "insights": insights,
    }

    # ── Core persist ──────────────────────────────────────────────────────────
    snapshot_id = _save_snapshot(conn, project_id, all_scores, metadata)
    passage_score_ids = _save_passage_scores(conn, snapshot_id, scored_passages)
    _save_content_scores(conn, snapshot_id, contents, scored_passages, passage_score_ids)
    conn.commit()
    log.info(f"[{project_id}] Core snapshot + passage scores committed")

    # ── Content versioning (non-critical) ─────────────────────────────────────
    try:
        _save_content_versions(conn, snapshot_id, contents, scored_passages)
        conn.commit()
        log.info(f"[{project_id}] Content versions saved")
    except Exception as exc:
        log.warning(f"[{project_id}] Failed to save content versions: {exc}")
        conn.rollback()

    # ── Recommendations (non-critical) ────────────────────────────────────────
    try:
        save_recommendations(conn, project_id, snapshot_id, recommendations)
        conn.commit()
        log.info(f"[{project_id}] Recommendations saved")
    except Exception as exc:
        log.warning(f"[{project_id}] Failed to save recommendations: {exc}")
        conn.rollback()

    # ── Fanout queries + coverage map (non-critical) ───────────────────────────
    real_targets = [t for t in fallback_targets if t["id"]]
    if real_targets and fanout_flat:
        try:
            real_grouped = fanout_grouped[:len(real_targets)]
            fanout_query_ids = _save_fanout_queries(conn, real_targets, real_grouped, snapshot_id)
            n_targets = len(target_texts)
            fanout_coverage_entries = coverage_map[n_targets:] if len(coverage_map) > n_targets else []
            if fanout_query_ids and fanout_coverage_entries:
                _save_fanout_coverage_map(conn, fanout_query_ids, fanout_coverage_entries, all_passages)
            # Persist query embeddings on the newly saved fanout_query rows
            _update_fanout_query_embeddings(conn, fanout_query_ids, fanout_flat, fanout_emb_cache)
            conn.commit()
            log.info(f"[{project_id}] Fanout queries + coverage map saved ({len(fanout_query_ids)} queries)")
        except Exception as exc:
            log.warning(f"[{project_id}] Failed to save fanout data: {exc}")
            conn.rollback()

    # ── Citation verification (non-critical — uses Gemini Grounding API) ─────
    if target_queries:
        try:
            website_url: str = project["websiteUrl"]
            # Load known competitor domains for is_competitor flagging
            with conn.cursor() as _cur:
                _cur.execute(
                    'SELECT "websiteUrl" FROM competitors WHERE "projectId" = %s AND "isConfirmed" = TRUE',
                    (project_id,),
                )
                _competitor_domains = [
                    _extract_domain(row[0]) for row in _cur.fetchall() if row[0]
                ]
            citation_results = await check_citations(
                target_queries, website_url, project_id,
                known_competitor_domains=_competitor_domains,
                target_language=language,
                target_country=target_country,
            )
            save_citation_checks(conn, project_id, snapshot_id, citation_results)
            conn.commit()
            cited_count = sum(1 for r in citation_results if r["user_cited"])
            log.info(
                f"[{project_id}] Citation checks: {cited_count}/{len(citation_results)} queries cite user"
            )

            # ── Competitor citation analysis (non-critical, best-effort) ─────
            try:
                # Pass query text through so gap report knows what was searched
                enriched = [
                    {**r, "query_text": tq["queryText"]}
                    for r, tq in zip(citation_results, target_queries)
                ]
                gap_reports = await analyze_competitor_citations(enriched, contents, project_id)
                if gap_reports:
                    # Store gap reports in snapshot metadata (no separate table needed yet)
                    with conn.cursor() as cur:
                        cur.execute(
                            """
                            UPDATE project_score_snapshots
                            SET metadata = metadata || %s::jsonb
                            WHERE id = %s
                            """,
                            (
                                __import__("json").dumps({"competitor_gap_reports": gap_reports}),
                                snapshot_id,
                            ),
                        )
                    conn.commit()
                    log.info(f"[{project_id}] Competitor gap reports saved: {len(gap_reports)}")
            except Exception as gap_exc:
                log.warning(f"[{project_id}] Competitor analysis failed: {gap_exc}")
                conn.rollback()

        except Exception as exc:
            log.warning(f"[{project_id}] Citation verification failed: {exc}")
            conn.rollback()

    log.info(f"[{project_id}] Saved snapshot {snapshot_id}")
    return {"snapshot_id": snapshot_id, "scores": all_scores, "insights": insights}
