from __future__ import annotations

"""
Full project scoring pipeline.

Unlike the preview pipeline (which crawls live), this pipeline reads
confirmed+fetched content from the DB and saves structured score records.

Steps:
1. Load project data, target queries, and confirmed passages from DB
2. Generate fanout queries (Gemini)
3. Embed fanout queries + passages (Voyage AI) → fanout coverage score
4. Score passage quality (Claude) → passage_quality_score + per-passage scores
5. Chunkability heuristic → chunkability_score
6. Entity coherence heuristic → entity_coherence_score
7. Cross-platform score from contents table → cross_platform_score
8. Composite AI Readiness Score
9. Generate insights (Claude/Gemini)
10. Save ProjectScoreSnapshot + ContentScore + PassageScore records
"""

import asyncio
import json
import logging
import time
from typing import Any

from .config import config
from .embeddings import embed_texts, compute_coverage
from .fetcher import fetch_url
from .segmenter import segment_html
from .scoring import (
    generate_fanout_queries_grouped,
    score_passage_quality,
    score_chunkability,
    score_entity_coherence,
    compute_ai_readiness,
    generate_insights,
)
from .recommendations import generate_recommendations, save_recommendations

log = logging.getLogger(__name__)

KNOWN_PLATFORMS = ["linkedin", "reddit", "medium", "youtube", "substack", "news"]


# ── DB helpers ────────────────────────────────────────────────────────────────

def _load_project(conn, project_id: str) -> dict | None:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT p."websiteUrl", p."brandName",
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
    """Return confirmed+fetched contents with their passages."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, url, title, platform, "contentType", "wordCount"
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
                SELECT id, "passageText", "passageIndex", "wordCount", heading
                FROM passages
                WHERE "contentId" = %s
                ORDER BY "passageIndex"
                """,
                (content["id"],),
            )
            content["passages"] = [
                {
                    "id": r["id"],
                    "passage_text": r["passageText"],
                    "passage_index": r["passageIndex"],
                    "word_count": r["wordCount"] or 0,
                    "heading": r["heading"],
                }
                for r in cur.fetchall()
            ]

    return contents


def _load_confirmed_platforms(conn, project_id: str) -> dict[str, list[str]]:
    """Return {platform: [url, ...]} for confirmed contents."""
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


# ── Auto-fetch unfetched content ──────────────────────────────────────────────

async def _auto_fetch_unfetched(conn, project_id: str) -> None:
    """
    Fetch and segment any confirmed content that hasn't been fetched yet.
    Saves rawText, wordCount, title, lastFetchedAt, and passage records.
    Skips silently on fetch failure (content will be excluded from scoring).
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

        with conn.cursor() as cur:
            # Update content record
            cur.execute(
                """
                UPDATE contents
                SET title = COALESCE(title, %s),
                    "wordCount" = %s,
                    "rawText" = %s,
                    "lastFetchedAt" = NOW()
                WHERE id = %s
                """,
                (result["title"], result["word_count"], result["raw_text"], cid),
            )
            # Insert passages (delete existing first to avoid duplicates)
            cur.execute('DELETE FROM passages WHERE "contentId" = %s', (cid,))
            for p in passages:
                cur.execute(
                    """
                    INSERT INTO passages (id, "contentId", "passageText", "passageIndex", "wordCount", heading, "createdAt")
                    VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, NOW())
                    """,
                    (cid, p["passageText"], p["passageIndex"], p["wordCount"], p.get("heading")),
                )

        conn.commit()
        log.info(f"[{project_id}] Fetched {url}: {len(passages)} passages")


# ── Save results ──────────────────────────────────────────────────────────────

def _save_fanout_queries(
    conn,
    target_queries: list[dict],
    fanout_grouped: list[list[str]],
    batch_id: str,
) -> list[str]:
    """
    Save FanoutQuery records for each generated fanout query.
    Returns flat list of fanout_query UUIDs in the same order as the flat fanout list.
    """
    fanout_query_ids: list[str] = []
    with conn.cursor() as cur:
        for target, fanout_texts in zip(target_queries, fanout_grouped):
            for text in fanout_texts:
                cur.execute(
                    """
                    INSERT INTO fanout_queries (id, "targetQueryId", "queryText", "queryType", "batchId", "generatedAt")
                    VALUES (gen_random_uuid(), %s, %s, 'generated', %s, NOW())
                    RETURNING id
                    """,
                    (target["id"], text, batch_id),
                )
                fanout_query_ids.append(cur.fetchone()["id"])
    return fanout_query_ids


def _save_fanout_coverage_map(
    conn,
    fanout_query_ids: list[str],
    coverage_entries: list[dict],
    all_passages: list[dict],
) -> None:
    """Save FanoutCoverageMap records linking each fanout query to its best-matching passage."""
    with conn.cursor() as cur:
        for fq_id, entry in zip(fanout_query_ids, coverage_entries):
            p_idx = entry["best_passage_index"]
            if p_idx < 0 or p_idx >= len(all_passages):
                continue
            passage_id = all_passages[p_idx]["id"]
            cur.execute(
                """
                INSERT INTO fanout_coverage_map (id, "fanoutQueryId", "passageId", "similarityScore", "isCovered", "createdAt")
                VALUES (gen_random_uuid(), %s, %s, %s, %s, NOW())
                """,
                (fq_id, passage_id, entry["similarity_score"], entry["is_covered"]),
            )


def _save_snapshot(conn, project_id: str, scores: dict[str, float], metadata: dict) -> str:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO project_score_snapshots (
                id, "projectId", "snapshotType",
                "aiReadinessScore", "fanoutCoverageScore", "passageQualityScore",
                "chunkabilityScore", "entityCoherenceScore", "crossPlatformScore",
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
                scores["passage_quality_score"],
                scores["chunkability_score"],
                scores["entity_coherence_score"],
                scores["cross_platform_score"],
                json.dumps(metadata),
            ),
        )
        return cur.fetchone()["id"]


def _save_passage_scores(conn, snapshot_id: str, scored_passages: list[dict]) -> dict[str, str]:
    """Insert PassageScore rows. Returns {passage_id: passage_score_id}."""
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
                    "selfContainedness", "claimClarity", "informationDensity",
                    "completeness", "verifiability", "overallScore",
                    "createdAt"
                )
                VALUES (
                    gen_random_uuid(), %s, %s,
                    %s, %s, %s, %s, %s, %s,
                    NOW()
                )
                RETURNING id
                """,
                (
                    passage_id,
                    snapshot_id,
                    criteria.get("self_containedness"),
                    criteria.get("claim_clarity"),
                    criteria.get("information_density"),
                    criteria.get("completeness"),
                    criteria.get("verifiability"),
                    sp.get("overall_score"),
                ),
            )
            ps_id = cur.fetchone()["id"]
            id_map[passage_id] = ps_id
    return id_map


def _save_content_scores(
    conn,
    snapshot_id: str,
    contents: list[dict],
    scored_passages: list[dict],
    passage_score_ids: dict[str, str],
) -> None:
    # Build lookup: passage_id → overall_score
    passage_scores_by_id = {sp["id"]: sp["overall_score"] for sp in scored_passages if sp.get("id")}

    with conn.cursor() as cur:
        for content in contents:
            passages = content.get("passages", [])
            if not passages:
                continue

            # Average passage quality for this content
            p_scores = [passage_scores_by_id[p["id"]] for p in passages if p["id"] in passage_scores_by_id]
            overall = round(sum(p_scores) / len(p_scores), 3) if p_scores else 0.5

            # Weakest passage
            weakest_id: str | None = None
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
                    "overallScore", "passageQualityScore",
                    "weakestPassageId", "createdAt"
                )
                VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, NOW())
                """,
                (content["id"], snapshot_id, overall, overall, weakest_id),
            )


# ── Main pipeline ─────────────────────────────────────────────────────────────

async def run_full_pipeline(conn, project_id: str) -> dict[str, Any]:
    start = time.monotonic()

    # 0. Auto-fetch any confirmed content that hasn't been fetched yet
    await _auto_fetch_unfetched(conn, project_id)

    # 1. Load data
    project = _load_project(conn, project_id)
    if not project:
        raise ValueError(f"Project {project_id} not found")

    brand_name: str = project["brandName"]
    language: str = project["preferredLocale"] or "en"
    target_queries = _load_target_queries(conn, project_id)
    contents = _load_contents_with_passages(conn, project_id)
    platform_results = _load_confirmed_platforms(conn, project_id)

    if not contents:
        raise ValueError("No confirmed+fetched content found — confirm and fetch content first")

    all_passages = [p for c in contents for p in c["passages"]]
    log.info(
        f"[{project_id}] Loaded {len(contents)} contents, "
        f"{len(all_passages)} passages, {len(target_queries)} queries"
    )

    # Build pages structure compatible with heuristic scorers
    pages = [
        {
            "url": c["url"],
            "title": c.get("title"),
            "word_count": c.get("wordCount") or 0,
            "passages": c["passages"],
        }
        for c in contents
    ]

    # 2. Fanout queries — generate per target to track which fanout belongs to which target
    fallback_targets = target_queries or [{"id": None, "queryText": "what is " + brand_name}]
    target_texts = [t["queryText"] for t in fallback_targets]
    fanout_task = asyncio.create_task(
        generate_fanout_queries_grouped(target_texts, brand_name, language)
    )

    # 5–7. Heuristic scores (synchronous)
    chunkability = score_chunkability(pages)
    entity_coherence = score_entity_coherence(pages, brand_name)
    cross_platform = _compute_cross_platform_from_db(platform_results)

    fanout_grouped = await fanout_task  # list[list[str]] — one list per target
    fanout_flat = [text for group in fanout_grouped for text in group]
    all_queries = target_texts + fanout_flat
    log.info(f"[{project_id}] Generated {len(fanout_flat)} fanout queries across {len(fallback_targets)} targets")

    # 3. Embed + coverage
    coverage_map: list[dict] = []
    passage_texts = [p["passage_text"][:500] for p in all_passages]
    if passage_texts and all_queries:
        q_embs, p_embs = await asyncio.gather(
            embed_texts(all_queries, input_type="query"),
            embed_texts(passage_texts, input_type="document"),
        )
        fanout_coverage, coverage_map = compute_coverage(q_embs, p_embs, config.COVERAGE_THRESHOLD)
        if coverage_map:
            max_sim = max(e["similarity_score"] for e in coverage_map)
            avg_sim = sum(e["similarity_score"] for e in coverage_map) / len(coverage_map)
            covered_n = sum(1 for e in coverage_map if e["is_covered"])
            log.info(
                f"[{project_id}] Coverage: {covered_n}/{len(coverage_map)} queries covered "
                f"(threshold={config.COVERAGE_THRESHOLD}) — "
                f"max_sim={max_sim:.3f}, avg_sim={avg_sim:.3f}"
            )
    else:
        fanout_coverage = 0.0
        log.warning(f"[{project_id}] Skipping fanout coverage: passage_texts={len(passage_texts)}, all_queries={len(all_queries)}")

    # 4. Passage quality (returns per-passage scores with criteria)
    passage_quality, scored_passages = await score_passage_quality(all_passages)
    log.info(f"[{project_id}] Passage quality: {passage_quality:.2f} ({len(scored_passages)} passages scored)")

    # 8. Composite
    sub_scores = {
        "fanout_coverage_score": fanout_coverage,
        "passage_quality_score": passage_quality,
        "chunkability_score": chunkability,
        "entity_coherence_score": entity_coherence,
        "cross_platform_score": cross_platform,
    }
    ai_readiness = compute_ai_readiness(sub_scores)
    all_scores = {"ai_readiness_score": ai_readiness, **sub_scores}

    # 9. Insights + recommendations (parallel)
    insights, recommendations = await asyncio.gather(
        generate_insights(brand_name, all_scores, language),
        generate_recommendations(brand_name, all_scores, language),
    )

    elapsed = round(time.monotonic() - start, 2)
    log.info(f"[{project_id}] Scoring done in {elapsed}s — AI Readiness: {ai_readiness:.1%}")

    # 10. Persist
    metadata = {
        "elapsed_seconds": elapsed,
        "contents_count": len(contents),
        "passages_count": len(all_passages),
        "fanout_queries_count": len(fanout_flat),
        "insights": insights,
    }

    # ── Core persist (always committed first) ─────────────────────────────
    snapshot_id = _save_snapshot(conn, project_id, all_scores, metadata)
    passage_score_ids = _save_passage_scores(conn, snapshot_id, scored_passages)
    _save_content_scores(conn, snapshot_id, contents, scored_passages, passage_score_ids)
    conn.commit()
    log.info(f"[{project_id}] Core snapshot + passage scores committed")

    # ── Recommendations (non-critical — failure does not block the analysis) ──
    try:
        save_recommendations(conn, project_id, snapshot_id, recommendations)
        conn.commit()
        log.info(f"[{project_id}] Recommendations saved")
    except Exception as exc:
        log.warning(f"[{project_id}] Failed to save recommendations: {exc}")
        conn.rollback()

    # ── Fanout queries + coverage map (non-critical) ───────────────────────
    real_targets = [t for t in fallback_targets if t["id"]]
    if real_targets and fanout_flat:
        try:
            real_grouped = fanout_grouped[:len(real_targets)]
            fanout_query_ids = _save_fanout_queries(conn, real_targets, real_grouped, snapshot_id)
            n_targets = len(target_texts)
            fanout_coverage_entries = coverage_map[n_targets:] if len(coverage_map) > n_targets else []
            if fanout_query_ids and fanout_coverage_entries:
                _save_fanout_coverage_map(conn, fanout_query_ids, fanout_coverage_entries, all_passages)
            conn.commit()
            log.info(f"[{project_id}] Fanout queries + coverage map saved ({len(fanout_query_ids)} queries)")
        except Exception as exc:
            log.warning(f"[{project_id}] Failed to save fanout data: {exc}")
            conn.rollback()

    log.info(f"[{project_id}] Saved snapshot {snapshot_id}")
    return {"snapshot_id": snapshot_id, "scores": all_scores, "insights": insights}


def _compute_cross_platform_from_db(platform_results: dict[str, list[str]]) -> float:
    """Score based on confirmed content across known non-website platforms."""
    if not platform_results:
        return 0.0
    platforms_with_content = sum(1 for urls in platform_results.values() if urls)
    return round(platforms_with_content / len(KNOWN_PLATFORMS), 3)
