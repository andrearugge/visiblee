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


def _get_base_system_prompt(target_language: str, target_country: str) -> str:
    lang_name = _LANG_NAMES.get(target_language[:2].lower(), "English")
    return (
        f"You are simulating a Google AI Mode response for a user in {target_country} "
        f"searching in {lang_name}. Answer the query as Google AI Mode would, "
        f"using web sources relevant to that market and language."
    )


def _build_enriched_system_prompt(
    base_language: str,
    base_country: str,
    context_addendum: str,
) -> str:
    base = _get_base_system_prompt(base_language, base_country)
    return (
        f"{base}\n\n"
        f"Additional context about the user performing this search:\n"
        f"{context_addendum}\n\n"
        f"Consider this user context when generating your response, as it may influence "
        f"which sources and information are most relevant."
    )


async def _check_single_query(
    query_text: str,
    target_query_id: str,
    user_domain: str,
    competitor_domains: set[str],
    target_language: str = "en",
    target_country: str = "US",
    system_prompt_override: str | None = None,
) -> dict[str, Any]:
    system_prompt = system_prompt_override or _get_base_system_prompt(target_language, target_country)
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
        title = getattr(web, "title", None) or ""
        domain = _extract_domain(web.uri)
        # Gemini grounding returns redirect URLs (vertexaisearch.cloud.google.com).
        # The actual source domain is in web.title — use it as fallback.
        if not domain or "vertexaisearch.cloud.google.com" in domain:
            domain = _extract_domain(title) or title.lower().strip()
        cited_sources.append({
            "url": web.uri,
            "title": title,
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
    conn.commit()


def save_citation_check_single(
    conn,
    project_id: str,
    target_query_id: str,
    result: dict[str, Any],
    snapshot_id: str | None = None,
) -> str:
    """
    Save a single citation check result (replacing any previous one for the same query).
    Returns the new citation_check id.
    """
    with conn.cursor() as cur:
        cur.execute(
            'DELETE FROM citation_checks WHERE "projectId" = %s AND "targetQueryId" = %s',
            (project_id, target_query_id),
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
            RETURNING id
            """,
            (
                project_id,
                target_query_id,
                snapshot_id,
                _json.dumps(result.get("cited_sources", [])),
                result.get("user_cited", False),
                result.get("user_cited_position"),
                result.get("user_cited_segment"),
                result.get("response_text"),
                _json.dumps(result.get("search_queries", [])),
                result.get("raw_response"),
            ),
        )
        row = cur.fetchone()
    conn.commit()
    return row["id"]


def save_citation_check_variant(
    conn,
    citation_check_id: str,
    intent_profile_id: str,
    result: dict[str, Any],
    context_prompt_used: str,
) -> None:
    """Save a citation check variant for an intent profile."""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO citation_check_variants (
                id, "citationCheckId", "intentProfileId",
                "userCited", "userCitedPosition", "userCitedSegment",
                "citedSources", "responseText", "searchQueries",
                "contextPromptUsed", "createdAt"
            ) VALUES (
                gen_random_uuid(), %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                %s, NOW()
            )
            ON CONFLICT ("citationCheckId", "intentProfileId") DO UPDATE SET
                "userCited" = EXCLUDED."userCited",
                "userCitedPosition" = EXCLUDED."userCitedPosition",
                "userCitedSegment" = EXCLUDED."userCitedSegment",
                "citedSources" = EXCLUDED."citedSources",
                "responseText" = EXCLUDED."responseText",
                "searchQueries" = EXCLUDED."searchQueries",
                "contextPromptUsed" = EXCLUDED."contextPromptUsed"
            """,
            (
                citation_check_id,
                intent_profile_id,
                result.get("user_cited", False),
                result.get("user_cited_position"),
                result.get("user_cited_segment"),
                _json.dumps(result.get("cited_sources", [])),
                result.get("response_text"),
                _json.dumps(result.get("search_queries", [])),
                context_prompt_used,
            ),
        )
    conn.commit()


async def run_citation_check_enriched(
    conn,
    project_id: str,
    target_query_id: str,
    query_text: str,
    user_domain: str,
    target_language: str,
    target_country: str,
    intent_profiles: list[dict],
    known_competitor_domains: list[str] | None = None,
    max_variants: int = 3,
) -> dict:
    """
    Run citation check base + context variants for each intent profile.

    intent_profiles: list of dicts with keys: id, name, slug, contextPrompt
    Returns summary dict with base result and variant results.
    """
    if not _gemini:
        log.warning(f"[{project_id}] Gemini not configured — skipping enriched citation check")
        return {}

    user_domain_clean = _extract_domain(user_domain) or user_domain.lstrip("www.")
    competitor_domains = set(known_competitor_domains or [])

    # 1. Base check
    base_result = await _check_single_query(
        query_text=query_text,
        target_query_id=target_query_id,
        user_domain=user_domain_clean,
        competitor_domains=competitor_domains,
        target_language=target_language,
        target_country=target_country,
    )

    # Save base check, get citation_check_id
    citation_check_id = save_citation_check_single(
        conn, project_id, target_query_id, base_result
    )

    status = "CITED ✓" if base_result["user_cited"] else "NOT CITED ✗"
    log.info(f"[{project_id}] Enriched citation base '{query_text[:50]}': {status}")

    # 2. Context variants
    variants: list[dict] = []
    for profile in intent_profiles[:max_variants]:
        context_prompt = profile.get("contextPrompt") or ""
        if not context_prompt:
            continue

        enriched_prompt = _build_enriched_system_prompt(
            base_language=target_language,
            base_country=target_country,
            context_addendum=context_prompt,
        )

        try:
            variant_result = await _check_single_query(
                query_text=query_text,
                target_query_id=target_query_id,
                user_domain=user_domain_clean,
                competitor_domains=competitor_domains,
                target_language=target_language,
                target_country=target_country,
                system_prompt_override=enriched_prompt,
            )
        except Exception as exc:
            log.warning(
                f"[{project_id}] Variant check failed for profile {profile.get('slug')}: {exc}"
            )
            continue

        save_citation_check_variant(
            conn,
            citation_check_id=citation_check_id,
            intent_profile_id=profile["id"],
            result=variant_result,
            context_prompt_used=enriched_prompt,
        )

        v_status = "CITED ✓" if variant_result["user_cited"] else "NOT CITED ✗"
        log.info(
            f"[{project_id}] Variant '{profile.get('slug')}' '{query_text[:40]}': {v_status}"
        )

        variants.append({
            "profileName": profile.get("name"),
            "profileSlug": profile.get("slug"),
            "userCited": variant_result["user_cited"],
            "userCitedPosition": variant_result.get("user_cited_position"),
            "citedSources": variant_result.get("cited_sources", []),
        })

    return {
        "citationCheckId": citation_check_id,
        "base": base_result,
        "variants": variants,
    }
