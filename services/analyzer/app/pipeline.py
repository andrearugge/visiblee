from __future__ import annotations

"""
Preview analysis pipeline — orchestrates all steps async.
Uses the same heuristic scoring as the full pipeline (v2).
Citation verification is NOT run in preview (latency target: <60s).
"""

import asyncio
import time
from typing import Any

from .config import config
from .crawler import crawl_website, search_cross_platform
from .embeddings import embed_texts, compute_coverage
from .scoring import (
    generate_fanout_queries,
    score_citation_power,
    score_entity_authority,
    score_extractability,
    score_source_authority,
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

    # ── Step 3: Fanout query generation ─────────────────────────────────────
    fanout_task = asyncio.create_task(
        generate_fanout_queries(query_targets, brand_name, language)
    )

    # ── Step 4+5: Heuristic scores (synchronous, zero LLM calls) ────────────
    # Adapt crawler page format to the v2 content format expected by scorers
    contents = [
        {
            "id": None,
            "passages": [
                {
                    **p,
                    # crawler may use snake_case keys — normalise for scorers
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

    citation_power, _scored = score_citation_power(contents)
    entity_authority = score_entity_authority(contents, brand_name)
    extractability = score_extractability(contents)
    source_authority = score_source_authority(platform_results)

    all_queries = await fanout_task

    # ── Step 6: Embed queries + passages, compute coverage (binary for preview) ──
    passage_texts = [p["passage_text"][:500] for p in all_passages]

    if passage_texts and all_queries:
        query_embeddings, passage_embeddings = await asyncio.gather(
            embed_texts(all_queries, input_type="query"),
            embed_texts(passage_texts, input_type="document"),
        )
        fanout_coverage, coverage_map = compute_coverage(
            query_embeddings, passage_embeddings, config.COVERAGE_THRESHOLD
        )
    else:
        fanout_coverage = 0.0
        coverage_map = []

    # ── Step 7: Composite score ──────────────────────────────────────────────
    sub_scores = {
        "fanout_coverage_score":  fanout_coverage,
        "citation_power_score":   citation_power,
        "entity_authority_score": entity_authority,
        "extractability_score":   extractability,
        "source_authority_score": source_authority,
    }
    ai_readiness = compute_ai_readiness(sub_scores)

    # ── Step 8: Insights ─────────────────────────────────────────────────────
    all_scores = {"ai_readiness_score": ai_readiness, **sub_scores}
    insights = await generate_insights(brand_name, all_scores, language)

    elapsed = round(time.monotonic() - start, 2)

    return {
        "scores": all_scores,
        "insights": insights,
        "contents_found": contents_found,
        "analysis_data": {
            "elapsed_seconds": elapsed,
            "fanout_queries_count": len(all_queries),
            "passages_count": len(all_passages),
            "coverage_map": coverage_map[:50],
            "platform_results": {k: len(v) for k, v in platform_results.items()},
            "pages": [
                {"url": p["url"], "title": p.get("title"), "word_count": p.get("word_count", 0)}
                for p in pages
            ],
        },
    }
