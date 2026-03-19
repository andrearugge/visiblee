from __future__ import annotations

"""
Full content discovery pipeline.
Brave Search (multi-query: own + platform-specific + news + general) → LLM classification → platform detection.
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
    "instagram.com": "other",
    "tiktok.com": "other",
    "facebook.com": "other",
    "x.com": "other",
    "twitter.com": "other",
}

# Substrings that suggest a news/press site
_NEWS_HINTS = [
    "techcrunch", "forbes", "wired", "venturebeat", "businessinsider",
    "wsj", "nytimes", "theguardian", "bloomberg", "reuters",
    "corriere", "repubblica", "sole24ore", "ilsole24ore", "lastampa",
    "ilfattoquotidiano", "huffingtonpost", "ansa", "adnkronos",
    "lemonde", "lefigaro", "elpais", "spiegel", "handelsblatt",
]

# Platform-specific targeted searches (always run)
_PLATFORM_SEARCHES: list[tuple[str, int]] = [
    ("site:linkedin.com", 10),
    ("site:reddit.com", 10),
    ("site:medium.com", 10),
    ("site:youtube.com", 10),
    ("site:substack.com", 10),
]

# News sites to search by language
_NEWS_SITES_BY_LANG: dict[str, list[str]] = {
    "it": [
        "corriere.it", "repubblica.it", "sole24ore.it", "lastampa.it",
        "ilfattoquotidiano.it", "ansa.it", "adnkronos.com",
    ],
    "en": [
        "techcrunch.com", "forbes.com", "wired.com", "businessinsider.com",
        "venturebeat.com", "theguardian.com", "reuters.com",
    ],
    "de": [
        "spiegel.de", "handelsblatt.com", "faz.net", "welt.de",
    ],
    "fr": [
        "lemonde.fr", "lefigaro.fr", "liberation.fr", "lesechos.fr",
    ],
    "es": [
        "elpais.com", "elmundo.es", "expansion.com", "cincodias.elpais.com",
    ],
}
_NEWS_SITES_FALLBACK = _NEWS_SITES_BY_LANG["en"]


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


async def _brave_search(query: str, count: int = 20) -> list[dict[str, str]]:
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
                timeout=12,
            )
            if resp.status_code != 200:
                log.warning(f"Brave returned {resp.status_code} for '{query}'")
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


def _classify_by_domain(results: list[dict], domain: str) -> list[dict]:
    """Fallback classification: own if on brand domain, else mention."""
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
    """Classify a batch of results via Gemini Flash."""
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
    Multi-signal content discovery pipeline.

    Parallel searches:
    1. site:{domain}                   — own content
    2. "{brand}" site:linkedin.com     — LinkedIn presence
    3. "{brand}" site:reddit.com       — Reddit threads
    4. "{brand}" site:medium.com       — Medium articles
    5. "{brand}" site:youtube.com      — YouTube videos
    6. "{brand}" site:substack.com     — Substack posts
    7. "{brand}" site:{news1} OR ...   — Country-aware news/press
    8. "{brand}" -site:{domain}        — General web mentions (catch-all)

    Results are deduplicated, classified by Gemini, and tagged with platform.
    Returns list of {url, title, snippet, platform, contentType, confidence}.
    """
    domain = urlparse(website_url).netloc.lstrip("www.")
    lang = language[:2].lower()

    # Build news query: up to 5 country-relevant sites in a single search
    news_sites = _NEWS_SITES_BY_LANG.get(lang, _NEWS_SITES_FALLBACK)
    # Brave supports multi-site with space-separated site: operators
    news_query = f'"{brand_name}" ' + " OR ".join(f"site:{s}" for s in news_sites[:5])

    # All queries to run in parallel
    queries: list[tuple[str, int]] = [
        (f"site:{domain}", 20),                                    # 1. own
        (f'"{brand_name}" site:linkedin.com', 10),                 # 2. LinkedIn
        (f'"{brand_name}" site:reddit.com', 10),                   # 3. Reddit
        (f'"{brand_name}" site:medium.com', 10),                   # 4. Medium
        (f'"{brand_name}" site:youtube.com', 10),                  # 5. YouTube
        (f'"{brand_name}" site:substack.com', 10),                 # 6. Substack
        (news_query, 10),                                          # 7. News (country-aware)
        (f'"{brand_name}" -site:{domain}', 20),                    # 8. General mentions
    ]

    log.info(f"Discovery: running {len(queries)} parallel searches for {domain} (lang={lang})")

    all_batches = await asyncio.gather(*[_brave_search(q, c) for q, c in queries])

    # Deduplicate across all batches (preserve order: own content first)
    seen: set[str] = set()
    all_results: list[dict] = []
    for batch in all_batches:
        for r in batch:
            if r["url"] and r["url"] not in seen:
                seen.add(r["url"])
                all_results.append(r)

    if not all_results:
        log.warning(f"No Brave results for {domain}")
        return []

    log.info(f"Discovery: {len(all_results)} unique URLs before classification")

    # Classify in one Gemini call (cap at 60 to stay within token budget)
    classified = await _classify_with_gemini(all_results[:60], brand_name, domain)

    # Add platform tag
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
    log.info(
        f"Discovery for {domain}: {own_count} own + {mention_count} mentions "
        f"(from {len(all_results)} candidates)"
    )

    return final
