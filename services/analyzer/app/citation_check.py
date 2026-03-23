from __future__ import annotations

"""
Citation verification via Gemini API with Google Search grounding.

For each target query, asks Gemini (with google_search tool enabled) and
checks whether the user's domain appears in the cited sources.

Results are saved to the citation_checks table.
"""

import logging
from typing import Any
from urllib.parse import urlparse

from .config import config

log = logging.getLogger(__name__)

try:
    from google import genai as google_genai
    _gemini = google_genai.Client(api_key=config.GOOGLE_AI_API_KEY_GROUNDING) if config.GOOGLE_AI_API_KEY_GROUNDING else None
except ImportError:
    _gemini = None


def _extract_domain(url: str) -> str:
    try:
        return urlparse(url).netloc.lower().lstrip("www.")
    except Exception:
        return ""


async def check_citations(
    target_queries: list[dict],
    user_domain: str,
    project_id: str,
) -> list[dict[str, Any]]:
    """
    For each target query, ask Gemini with Google Search grounding
    and check if the user's domain is cited.

    Args:
        target_queries: list of {id, queryText}
        user_domain: the project's website domain (e.g. "example.com")
        project_id: for logging only

    Returns:
        list of citation check result dicts, one per query.
    """
    if not _gemini:
        log.warning(f"[{project_id}] Gemini not configured — skipping citation verification")
        return []

    user_domain_clean = _extract_domain(user_domain) or user_domain.lstrip("www.")
    results: list[dict[str, Any]] = []

    for tq in target_queries:
        query_text = tq.get("queryText", "")
        target_query_id = tq.get("id")

        try:
            response = await _gemini.aio.models.generate_content(
                model="gemini-2.5-flash",
                contents=query_text,
                config={
                    "tools": [{"google_search": {}}],
                },
            )

            cited_sources: list[dict] = []
            search_queries: list[str] = []

            candidate = response.candidates[0] if response.candidates else None
            grounding = getattr(candidate, "grounding_metadata", None) if candidate else None

            if grounding:
                # Extract cited sources from grounding chunks
                for chunk in (grounding.grounding_chunks or []):
                    web = getattr(chunk, "web", None)
                    if web and web.uri:
                        domain = _extract_domain(web.uri)
                        cited_sources.append({
                            "url": web.uri,
                            "title": getattr(web, "title", None),
                            "domain": domain,
                            "is_user": domain == user_domain_clean,
                        })

                # Extract the actual search queries Gemini issued
                search_queries = list(grounding.web_search_queries or [])

            user_cited = any(s["is_user"] for s in cited_sources)

            log.info(
                f"[{project_id}] Citation check '{query_text[:50]}': "
                f"user_cited={user_cited} sources={len(cited_sources)}"
            )

            results.append({
                "target_query_id": target_query_id,
                "cited_sources": cited_sources,
                "user_cited": user_cited,
                "search_queries": search_queries,
                "raw_response": getattr(response, "text", None),
            })

        except Exception as exc:
            log.warning(f"[{project_id}] Citation check failed for '{query_text[:50]}': {exc}")
            results.append({
                "target_query_id": target_query_id,
                "cited_sources": [],
                "user_cited": False,
                "search_queries": [],
                "raw_response": None,
            })

    return results


def save_citation_checks(
    conn,
    project_id: str,
    snapshot_id: str,
    results: list[dict[str, Any]],
) -> None:
    """Persist citation check results to the citation_checks table."""
    import json as _json

    with conn.cursor() as cur:
        for r in results:
            if not r.get("target_query_id"):
                continue
            cur.execute(
                """
                INSERT INTO citation_checks (
                    id, "projectId", "targetQueryId", "snapshotId",
                    "citedSources", "userCited", "searchQueries", "rawResponse",
                    "checkedAt"
                )
                VALUES (
                    gen_random_uuid(), %s, %s, %s,
                    %s, %s, %s, %s,
                    NOW()
                )
                """,
                (
                    project_id,
                    r["target_query_id"],
                    snapshot_id,
                    _json.dumps(r["cited_sources"]),
                    r["user_cited"],
                    _json.dumps(r["search_queries"]),
                    r.get("raw_response"),
                ),
            )
