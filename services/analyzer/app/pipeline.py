from __future__ import annotations

"""
Preview analysis pipeline — orchestrates all steps async.
"""

import asyncio
import time
from typing import Any

from .config import config
from .crawler import crawl_website, search_cross_platform
from .embeddings import embed_texts, compute_coverage
from .scoring import (
    generate_fanout_queries,
    score_passage_quality,
    score_chunkability,
    score_entity_coherence,
    score_cross_platform,
    generate_insights,
    compute_ai_readiness,
)


async def run_preview_pipeline(
    website_url: str,
    brand_name: str,
    query_targets: list[str],
    language: str = "en",
) -> dict[str, Any]:
    """
    Full micro-analysis pipeline. Returns score dict + metadata.
    Parallelises independent steps to stay under 60s.
    """
    start = time.monotonic()

    # ── Step 1+2: Crawl website + cross-platform search (parallel) ──────────
    crawl_task = asyncio.create_task(crawl_website(website_url))
    cross_platform_task = asyncio.create_task(search_cross_platform(brand_name))

    pages, platform_results = await asyncio.gather(crawl_task, cross_platform_task)

    contents_found = len(pages)
    all_passages = [p for page in pages for p in page.get("passages", [])]

    # ── Step 3: Fan-out query generation (parallel with embedding prep) ──────
    fanout_task = asyncio.create_task(
        generate_fanout_queries(query_targets, brand_name, language)
    )

    # ── Step 6+7: Heuristic scores (synchronous, fast) ──────────────────────
    chunkability = score_chunkability(pages)
    entity_coherence = score_entity_coherence(pages, brand_name)
    cross_platform = score_cross_platform(platform_results)

    all_queries = await fanout_task

    # ── Step 4: Embed queries + passages, compute coverage ──────────────────
    passage_texts = [p["passage_text"][:500] for p in all_passages]

    if passage_texts and all_queries:
        embed_queries_task = asyncio.create_task(
            embed_texts(all_queries, input_type="query")
        )
        embed_passages_task = asyncio.create_task(
            embed_texts(passage_texts, input_type="document")
        )
        query_embeddings, passage_embeddings = await asyncio.gather(
            embed_queries_task, embed_passages_task
        )
        fanout_coverage, coverage_map = compute_coverage(
            query_embeddings, passage_embeddings, config.COVERAGE_THRESHOLD
        )
    else:
        fanout_coverage = 0.0
        coverage_map = []

    # ── Step 5: Passage quality via Claude ──────────────────────────────────
    passage_quality, scored_passages = await score_passage_quality(all_passages)

    # ── Step 9: Composite score ──────────────────────────────────────────────
    sub_scores = {
        "fanout_coverage_score": fanout_coverage,
        "passage_quality_score": passage_quality,
        "chunkability_score": chunkability,
        "entity_coherence_score": entity_coherence,
        "cross_platform_score": cross_platform,
    }
    ai_readiness = compute_ai_readiness(sub_scores)

    # ── Step 10: Insights ────────────────────────────────────────────────────
    all_scores = {"ai_readiness_score": ai_readiness, **sub_scores}
    insights = await generate_insights(brand_name, all_scores, language)

    elapsed = round(time.monotonic() - start, 2)

    return {
        "scores": {
            "ai_readiness_score": ai_readiness,
            **sub_scores,
        },
        "insights": insights,
        "contents_found": contents_found,
        "analysis_data": {
            "elapsed_seconds": elapsed,
            "fanout_queries_count": len(all_queries),
            "passages_count": len(all_passages),
            "coverage_map": coverage_map[:50],  # cap for storage
            "platform_results": {k: len(v) for k, v in platform_results.items()},
            "pages": [
                {"url": p["url"], "title": p.get("title"), "word_count": p.get("word_count", 0)}
                for p in pages
            ],
        },
    }
