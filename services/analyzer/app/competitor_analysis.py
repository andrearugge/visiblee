from __future__ import annotations

"""
Competitor citation analysis.

For each citation check result that cites third-party sources (not the user),
fetches and scores the competitor page to generate a gap report comparing
the competitor's content signals against the user's nearest matching content.
"""

import logging
from typing import Any
from urllib.parse import urlparse

from .fetcher import fetch_url
from .segmenter import segment_html
from .scoring import score_citation_power

log = logging.getLogger(__name__)

# Maximum number of competitor pages to analyze per citation check run
MAX_COMPETITOR_PAGES = 5


def _extract_domain(url: str) -> str:
    try:
        return urlparse(url).netloc.lower().lstrip("www.")
    except Exception:
        return ""


def _build_gap_report(
    competitor_url: str,
    competitor_passages: list[dict],
    user_passages: list[dict],
    query_text: str,
) -> dict[str, Any]:
    """
    Compare competitor and user passage signals to produce a gap list.
    user_passages: passages from the user's content closest to the query.
    """

    def _agg(passages: list[dict], field: str, default: Any = False) -> Any:
        if not passages:
            return default
        vals = [p.get(field, default) for p in passages]
        if isinstance(default, bool):
            return any(vals)
        return sum(vals) / len(vals)

    comp_metrics = {
        "entity_density":       round(_agg(competitor_passages, "entityDensity", 0.0), 3),
        "has_statistics":       _agg(competitor_passages, "hasStatistics", False),
        "has_source_citation":  _agg(competitor_passages, "hasSourceCitation", False),
        "answer_first_ratio":   round(sum(1 for p in competitor_passages if p.get("isAnswerFirst", False)) / max(len(competitor_passages), 1), 2),
        "avg_word_count":       round(_agg(competitor_passages, "wordCount", 0), 0),
    }

    user_metrics = {
        "entity_density":       round(_agg(user_passages, "entityDensity", 0.0), 3),
        "has_statistics":       _agg(user_passages, "hasStatistics", False),
        "has_source_citation":  _agg(user_passages, "hasSourceCitation", False),
        "answer_first_ratio":   round(sum(1 for p in user_passages if p.get("isAnswerFirst", False)) / max(len(user_passages), 1), 2),
        "avg_word_count":       round(_agg(user_passages, "wordCount", 0), 0),
    }

    gaps: list[str] = []
    if comp_metrics["has_statistics"] and not user_metrics["has_statistics"]:
        gaps.append("Add statistics with attribution (competitor cites data, you don't)")
    if comp_metrics["has_source_citation"] and not user_metrics["has_source_citation"]:
        gaps.append("Cite external sources — competitor attributes claims to named sources")
    if comp_metrics["entity_density"] > user_metrics["entity_density"] + 0.05:
        gaps.append("Increase named-entity density — competitor content is more specific")
    if comp_metrics["answer_first_ratio"] > user_metrics["answer_first_ratio"] + 0.2:
        gaps.append("Use Definition Lead structure — start key sections with a direct answer")
    if 134 <= comp_metrics["avg_word_count"] <= 167 and not (134 <= user_metrics["avg_word_count"] <= 167):
        gaps.append("Restructure passages to 134–167 words for optimal AI extraction")

    return {
        "competitor_url": competitor_url,
        "competitor_domain": _extract_domain(competitor_url),
        "query": query_text,
        "competitor_metrics": comp_metrics,
        "user_metrics": user_metrics,
        "gaps": gaps,
    }


async def analyze_competitor_citations(
    citation_results: list[dict],
    user_contents: list[dict],
    project_id: str,
) -> list[dict[str, Any]]:
    """
    For sources cited by Gemini that are NOT the user's domain,
    fetch + score up to MAX_COMPETITOR_PAGES pages and produce gap reports.

    Args:
        citation_results: output from check_citations()
        user_contents: confirmed user contents with passages (from full_pipeline load)
        project_id: for logging

    Returns:
        list of gap report dicts
    """
    # Collect unique competitor URLs across all citation checks
    seen_urls: set[str] = set()
    to_analyze: list[tuple[str, str]] = []  # (url, query_text)

    for result in citation_results:
        query = result.get("query_text", "")
        for source in result.get("cited_sources", []):
            if source.get("is_user"):
                continue
            url = source.get("url", "")
            if url and url not in seen_urls:
                seen_urls.add(url)
                to_analyze.append((url, query))
                if len(to_analyze) >= MAX_COMPETITOR_PAGES:
                    break
        if len(to_analyze) >= MAX_COMPETITOR_PAGES:
            break

    if not to_analyze:
        return []

    # Flatten user passages for comparison
    all_user_passages = [p for c in user_contents for p in c.get("passages", [])]

    gap_reports: list[dict[str, Any]] = []

    for url, query_text in to_analyze:
        log.info(f"[{project_id}] Analyzing competitor page: {url}")
        try:
            fetch_result = await fetch_url(url)
            if not fetch_result:
                continue

            raw_passages = segment_html(fetch_result["html"])
            if not raw_passages:
                continue

            # Normalize passage keys for scorer
            comp_passages = [
                {
                    **p,
                    "id": None,
                    "passageText": p["passageText"],
                    "wordCount": p["wordCount"],
                }
                for p in raw_passages
            ]

            _, scored = score_citation_power([{"id": url, "passages": comp_passages}])

            gap = _build_gap_report(url, comp_passages, all_user_passages, query_text)
            gap["citation_power_score"] = round(
                sum(s["overall_score"] for s in scored) / len(scored), 3
            ) if scored else 0.0

            gap_reports.append(gap)

        except Exception as exc:
            log.warning(f"[{project_id}] Competitor analysis failed for {url}: {exc}")

    return gap_reports
