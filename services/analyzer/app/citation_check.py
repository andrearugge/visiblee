from __future__ import annotations

"""
Citation simulation via Gemini API with Google Search grounding.

For each target query, asks Gemini (with google_search tool enabled) and:
- Extracts the synthesized AI response text
- Extracts cited sources (URL, title, domain, position)
- Maps grounding_supports to determine which response segments each source backs
- Identifies whether the user's domain is cited, at what position, and which segment
- Captures Gemini's internal fan-out search queries (extremely valuable signal)

Results are saved to the citation_checks table (replacing previous checks for the
same query to keep only the latest).
"""

import json as _json
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


# ── Helpers ────────────────────────────────────────────────────────────────────

def _extract_domain(url: str) -> str:
    try:
        return urlparse(url).netloc.lower().lstrip("www.")
    except Exception:
        return ""


def _domain_matches(domain: str, target: str) -> bool:
    """Check domain equality handling subdomains (e.g. blog.example.com == example.com)."""
    target = target.lower().lstrip("www.")
    domain = domain.lower().lstrip("www.")
    return domain == target or domain.endswith("." + target)


# ── Core citation check ────────────────────────────────────────────────────────

async def check_citations(
    target_queries: list[dict],
    user_domain: str,
    project_id: str,
    known_competitor_domains: list[str] | None = None,
    target_language: str = "en",
    target_country: str = "US",
) -> list[dict[str, Any]]:
    """
    For each target query, simulate a Google AI Mode response and extract citation data.

    Args:
        target_queries: list of {"id": str, "queryText": str}
        user_domain: the project's website domain (e.g. "example.com")
        project_id: for logging only
        known_competitor_domains: domains already marked as competitors

    Returns:
        list of dicts, one per query:
        {
            target_query_id, user_cited, user_cited_position, user_cited_segment,
            cited_sources, search_queries, response_text, raw_response
        }
    """
    if not _gemini:
        log.warning(f"[{project_id}] Gemini not configured — skipping citation checks")
        return []

    user_domain_clean = _extract_domain(user_domain) or user_domain.lstrip("www.")
    competitor_domains = set(known_competitor_domains or [])
    results: list[dict[str, Any]] = []

    for tq in target_queries:
        query_text = tq.get("queryText", "")
        target_query_id = tq.get("id")

        try:
            result = await _check_single_query(
                query_text=query_text,
                target_query_id=target_query_id,
                user_domain=user_domain_clean,
                competitor_domains=competitor_domains,
                target_language=target_language,
                target_country=target_country,
            )
            status = "CITED ✓" if result["user_cited"] else "NOT CITED ✗"
            log.info(
                f"[{project_id}] Citation '{query_text[:50]}': {status} "
                f"pos={result['user_cited_position']} "
                f"sources={len(result['cited_sources'])} "
                f"internal_queries={len(result['search_queries'])}"
            )
            results.append(result)

        except Exception as exc:
            log.warning(f"[{project_id}] Citation check failed for '{query_text[:50]}': {exc}")
            results.append(_empty_result(target_query_id))

    return results


_LANG_NAMES = {
    "it": "Italian", "en": "English", "es": "Spanish",
    "fr": "French", "de": "German", "pt": "Portuguese",
}


async def _check_single_query(
    query_text: str,
    target_query_id: str,
    user_domain: str,
    competitor_domains: set[str],
    target_language: str = "en",
    target_country: str = "US",
) -> dict[str, Any]:
    lang_name = _LANG_NAMES.get(target_language[:2].lower(), "English")
    system_prompt = (
        f"You are simulating a Google AI Mode response for a user in {target_country} "
        f"searching in {lang_name}. Answer the query as Google AI Mode would, "
        f"using web sources relevant to that market and language."
    )
    response = await _gemini.aio.models.generate_content(
        model="gemini-2.5-flash",
        contents=[
            {"role": "user", "parts": [{"text": f"{system_prompt}\n\nQuery: {query_text}"}]},
        ],
        config={"tools": [{"google_search": {}}]},
    )

    if not response.candidates:
        return _empty_result(target_query_id)

    candidate = response.candidates[0]

    # ── Response text ──────────────────────────────────────────────────────────
    response_text = ""
    if candidate.content and candidate.content.parts:
        response_text = "".join(
            part.text for part in candidate.content.parts
            if hasattr(part, "text") and part.text
        )

    grounding = getattr(candidate, "grounding_metadata", None)
    if not grounding:
        return {
            **_empty_result(target_query_id),
            "response_text": response_text,
            "raw_response": response_text,
        }

    # ── Cited sources from grounding_chunks ────────────────────────────────────
    cited_sources: list[dict] = []
    chunks = getattr(grounding, "grounding_chunks", None) or []
    for i, chunk in enumerate(chunks):
        web = getattr(chunk, "web", None)
        if not web or not web.uri:
            continue
        domain = _extract_domain(web.uri)
        cited_sources.append({
            "url": web.uri,
            "title": getattr(web, "title", None) or "",
            "domain": domain,
            "is_user": _domain_matches(domain, user_domain),
            "is_competitor": any(_domain_matches(domain, cd) for cd in competitor_domains),
            "position": i + 1,
            "supported_text": None,  # filled below from grounding_supports
        })

    # ── Map grounding_supports → which text each source backs ─────────────────
    supports = getattr(grounding, "grounding_supports", None) or []
    for support in supports:
        segment = getattr(support, "segment", None)
        chunk_indices = getattr(support, "grounding_chunk_indices", None) or []
        if not segment or not chunk_indices:
            continue
        segment_text = getattr(segment, "text", "") or ""
        for idx in chunk_indices:
            if 0 <= idx < len(cited_sources):
                existing = cited_sources[idx]["supported_text"] or ""
                cited_sources[idx]["supported_text"] = (
                    existing + " […] " + segment_text if existing else segment_text
                )

    # ── Internal fan-out queries ───────────────────────────────────────────────
    search_queries = list(getattr(grounding, "web_search_queries", None) or [])

    # ── User citation status ───────────────────────────────────────────────────
    user_cited = any(s["is_user"] for s in cited_sources)
    user_cited_position: int | None = None
    user_cited_segment: str | None = None
    if user_cited:
        user_source = next(s for s in cited_sources if s["is_user"])
        user_cited_position = user_source["position"]
        user_cited_segment = user_source.get("supported_text")

    return {
        "target_query_id": target_query_id,
        "user_cited": user_cited,
        "user_cited_position": user_cited_position,
        "user_cited_segment": user_cited_segment,
        "cited_sources": cited_sources,
        "search_queries": search_queries,
        "response_text": response_text,
        "raw_response": response_text,
    }


def _empty_result(target_query_id: str) -> dict:
    return {
        "target_query_id": target_query_id,
        "user_cited": False,
        "user_cited_position": None,
        "user_cited_segment": None,
        "cited_sources": [],
        "search_queries": [],
        "response_text": "",
        "raw_response": None,
    }


# ── Persistence ────────────────────────────────────────────────────────────────

def save_citation_checks(
    conn,
    project_id: str,
    snapshot_id: str,
    results: list[dict[str, Any]],
) -> None:
    """Persist citation check results. Replaces previous check for the same query."""
    with conn.cursor() as cur:
        for r in results:
            if not r.get("target_query_id"):
                continue

            # Replace previous check for this query (keep only latest)
            cur.execute(
                'DELETE FROM citation_checks WHERE "projectId" = %s AND "targetQueryId" = %s',
                (project_id, r["target_query_id"]),
            )

            cur.execute(
                """
                INSERT INTO citation_checks (
                    id, "projectId", "targetQueryId", "snapshotId",
                    "citedSources", "userCited",
                    "userCitedPosition", "userCitedSegment", "responseText",
                    "searchQueries", "rawResponse", "checkedAt"
                ) VALUES (
                    gen_random_uuid(), %s, %s, %s,
                    %s, %s,
                    %s, %s, %s,
                    %s, %s, NOW()
                )
                """,
                (
                    project_id,
                    r["target_query_id"],
                    snapshot_id,
                    _json.dumps(r["cited_sources"]),
                    r["user_cited"],
                    r.get("user_cited_position"),
                    r.get("user_cited_segment"),
                    r.get("response_text"),
                    _json.dumps(r["search_queries"]),
                    r.get("raw_response"),
                ),
            )
