from __future__ import annotations

"""
Full content discovery pipeline.
Brave Search (site: + brand mentions) → LLM classification → platform detection.
"""

import asyncio
import json
import logging
from typing import Any
from urllib.parse import urlparse

import httpx

from .config import config

log = logging.getLogger(__name__)

# Platform domain → platform name mapping
_PLATFORM_MAP = {
    "linkedin.com": "linkedin",
    "medium.com": "medium",
    "substack.com": "substack",
    "reddit.com": "reddit",
    "youtube.com": "youtube",
}

# Substrings that suggest a news/press site
_NEWS_HINTS = [
    "techcrunch", "forbes", "wired", "venturebeat", "businessinsider",
    "wsj", "nytimes", "theguardian", "bloomberg", "reuters", "corriere",
    "repubblica", "sole24ore", "ilsole24ore",
]


def detect_platform(url: str) -> str:
    try:
        domain = urlparse(url).netloc.lower().lstrip("www.")
        for pattern, platform in _PLATFORM_MAP.items():
            if pattern in domain:
                return platform
        for hint in _NEWS_HINTS:
            if hint in domain:
                return "news"
        return "website"
    except Exception:
        return "other"


async def _brave_search_with_details(query: str, count: int = 20) -> list[dict[str, str]]:
    """Run a Brave web search and return [{url, title, snippet}]."""
    if not config.BRAVE_SEARCH_API_KEY:
        return []
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                "https://api.search.brave.com/res/v1/web/search",
                headers={
                    "Accept": "application/json",
                    "Accept-Encoding": "gzip",
                    "X-Subscription-Token": config.BRAVE_SEARCH_API_KEY,
                },
                params={"q": query, "count": min(count, 20)},
                timeout=10,
            )
            if resp.status_code != 200:
                return []
            data = resp.json()
            return [
                {
                    "url": r.get("url", ""),
                    "title": r.get("title", ""),
                    "snippet": r.get("description", ""),
                }
                for r in data.get("web", {}).get("results", [])
                if r.get("url")
            ]
        except Exception as e:
            log.warning(f"Brave search failed for '{query}': {e}")
            return []


def _classify_by_domain(
    results: list[dict],
    domain: str,
) -> list[dict]:
    """Simple fallback classification: own if on brand domain, else mention."""
    classified = []
    for r in results:
        url_domain = urlparse(r["url"]).netloc.lstrip("www.")
        content_type = "own" if domain in url_domain else "mention"
        classified.append({**r, "contentType": content_type, "confidence": 0.7})
    return classified


async def _classify_with_gemini(
    results: list[dict],
    brand_name: str,
    domain: str,
) -> list[dict]:
    """Classify a batch of results via Gemini 2.0 Flash."""
    try:
        from google import genai as google_genai
        gemini = google_genai.Client(api_key=config.GOOGLE_AI_API_KEY) if config.GOOGLE_AI_API_KEY else None
    except ImportError:
        gemini = None

    if not gemini:
        return _classify_by_domain(results, domain)

    items_json = json.dumps(
        [{"index": i, "url": r["url"], "title": r["title"], "snippet": r["snippet"]}
         for i, r in enumerate(results)],
        ensure_ascii=False,
    )

    prompt = (
        f'Classify web content for brand "{brand_name}" (domain: {domain}).\n\n'
        "Categories:\n"
        f'- "own": published ON the brand\'s domain ({domain})\n'
        '- "mention": covers/mentions the brand on a THIRD-PARTY site\n'
        '- "irrelevant": not meaningfully related to the brand\n\n'
        f"Results:\n{items_json}\n\n"
        'Return ONLY a JSON array: [{"index": 0, "type": "own"|"mention"|"irrelevant", "confidence": 0.0-1.0}]\n'
        "No markdown, no explanation — pure JSON only."
    )

    try:
        response = await gemini.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        text = response.text.strip()
        # Strip markdown code fences if present
        if text.startswith("```"):
            parts = text.split("```")
            text = parts[1].lstrip("json").strip() if len(parts) > 1 else text
        classifications = json.loads(text)
        cls_map = {c["index"]: c for c in classifications}

        classified = []
        for i, r in enumerate(results):
            cls = cls_map.get(i, {"type": "mention", "confidence": 0.5})
            if cls.get("type") == "irrelevant":
                continue
            classified.append({
                **r,
                "contentType": cls["type"],
                "confidence": float(cls.get("confidence", 0.5)),
            })
        return classified

    except Exception as e:
        log.warning(f"Gemini classification failed, using domain fallback: {e}")
        return _classify_by_domain(results, domain)


async def discover_content(
    website_url: str,
    brand_name: str,
    language: str = "en",
) -> list[dict[str, Any]]:
    """
    Full content discovery pipeline.

    Steps:
    1. Brave Search site:{domain} → own content candidates
    2. Brave Search "{brand_name}" -site:{domain} → mention candidates
    3. Deduplicate by URL
    4. Gemini classifies into own / mention / irrelevant
    5. Add platform detection

    Returns list of {url, title, snippet, platform, contentType, confidence}.
    """
    domain = urlparse(website_url).netloc.lstrip("www.")

    # 1+2: Parallel searches
    own_results, mention_results = await asyncio.gather(
        _brave_search_with_details(f"site:{domain}", count=50),
        _brave_search_with_details(f'"{brand_name}" -site:{domain}', count=20),
    )

    # 3: Deduplicate (preserve order: own first)
    seen: set[str] = set()
    all_results: list[dict] = []
    for r in own_results + mention_results:
        if r["url"] not in seen:
            seen.add(r["url"])
            all_results.append(r)

    if not all_results:
        log.warning(f"No Brave results for {domain}")
        return []

    # 4: Classify (cap at 40 to stay within token budget)
    classified = await _classify_with_gemini(all_results[:40], brand_name, domain)

    # 5: Add platform
    final: list[dict[str, Any]] = [
        {
            "url": r["url"],
            "title": r["title"],
            "snippet": r["snippet"],
            "platform": detect_platform(r["url"]),
            "contentType": r["contentType"],
            "confidence": r["confidence"],
        }
        for r in classified
    ]

    own_count = sum(1 for r in final if r["contentType"] == "own")
    mention_count = sum(1 for r in final if r["contentType"] == "mention")
    log.info(f"Discovery for {domain}: {own_count} own + {mention_count} mentions")

    return final
