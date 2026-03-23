from __future__ import annotations

"""
Full content discovery pipeline.
Brave Search (multi-query: own + platform-specific + news + general + intitle + backlink + sector)
→ Gemini Grounding supplemental (Google index)
→ LLM classification
→ platform detection.
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

_STOPWORDS_IT = {
    "come", "cosa", "qual", "quale", "dove", "quando", "perché", "chi",
    "il", "la", "le", "lo", "i", "gli", "di", "del", "della", "dei",
    "per", "con", "su", "tra", "fra", "è", "sono", "un", "una", "che",
    "non", "più", "anche", "questo", "quello", "nella", "nel", "al", "alla",
}
_STOPWORDS_EN = {
    "what", "how", "where", "when", "why", "who", "which", "the", "a", "an",
    "is", "are", "was", "for", "and", "or", "but", "in", "on", "at", "to",
    "of", "with", "from", "by", "not", "this", "that", "your", "my", "can",
}
_STOPWORDS = _STOPWORDS_IT | _STOPWORDS_EN

_LEGAL_SUFFIXES = [
    "srl", "s.r.l.", "spa", "s.p.a.", "snc", "s.n.c.",
    "sas", "s.a.s.", "ltd", "llc", "inc", "gmbh",
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


def _extract_sector_keywords(target_queries: list[str], brand_name: str) -> str:
    """Extract 2-3 sector keywords from target queries for more focused discovery."""
    if not target_queries:
        return ""
    brand_tokens = set(brand_name.lower().split())
    all_words = " ".join(target_queries).lower().split()
    keywords = [
        w for w in all_words
        if w not in _STOPWORDS and w not in brand_tokens and len(w) > 3 and w.isalpha()
    ]
    seen: set[str] = set()
    unique: list[str] = []
    for w in keywords:
        if w not in seen:
            seen.add(w)
            unique.append(w)
    return " ".join(unique[:3])


def _generate_brand_variations(brand_name: str) -> list[str]:
    """Generate common legal and formatting variations of the brand name."""
    name = brand_name.strip()
    name_lower = name.lower()
    variations: list[str] = []

    has_suffix = any(
        name_lower.endswith(s) or name_lower.endswith(f" {s}")
        for s in _LEGAL_SUFFIXES
    )
    if not has_suffix:
        variations.append(f"{name} srl")
        variations.append(f"{name} s.r.l.")
    else:
        clean = name
        for s in _LEGAL_SUFFIXES:
            for fmt in [f" {s}", f" {s.upper()}", f" {s.title()}"]:
                clean = clean.replace(fmt, "")
        clean = clean.strip()
        if clean and clean.lower() != name_lower:
            variations.append(clean)

    return variations[:4]


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
                    "source": "brave",
                }
                for r in data.get("web", {}).get("results", [])
                if r.get("url")
            ]
        except Exception as e:
            log.warning(f"Brave search failed for '{query}': {e}")
            return []


async def _discover_via_gemini_grounding(
    brand_name: str,
    target_queries: list[str],
    user_domain: str,
    existing_urls: set[str],
) -> list[dict]:
    """
    Use Gemini with Google Search grounding to find brand mentions in Google's index.
    Supplements Brave results with sources that Google can see but Brave might miss.
    Gracefully degrades if the API key or SDK is not available.
    """
    try:
        from google import genai as google_genai
        gemini = google_genai.Client(api_key=config.GOOGLE_AI_API_KEY) if config.GOOGLE_AI_API_KEY else None
    except ImportError:
        gemini = None

    if not gemini or not target_queries:
        return []

    additional: list[dict] = []

    for query_text in target_queries[:5]:
        try:
            response = await gemini.aio.models.generate_content(
                model="gemini-2.5-flash",
                contents=f"{query_text} {brand_name}",
                config={"tools": [{"google_search": {}}]},
            )

            if not response.candidates:
                continue

            candidate = response.candidates[0]
            grounding = getattr(candidate, "grounding_metadata", None)
            if not grounding:
                continue

            for chunk in (getattr(grounding, "grounding_chunks", None) or []):
                web = getattr(chunk, "web", None)
                if not web or not web.uri:
                    continue
                url = web.uri
                if url in existing_urls:
                    continue
                chunk_domain = urlparse(url).netloc.lstrip("www.")
                title = getattr(web, "title", "") or ""
                # Include if it's the brand domain OR mentions the brand name in title
                if user_domain in chunk_domain or brand_name.lower() in title.lower():
                    additional.append({
                        "url": url,
                        "title": title,
                        "snippet": "",
                        "source": "gemini_grounding",
                    })

        except Exception as e:
            log.warning(f"Gemini grounding discovery failed for '{query_text[:50]}': {e}")
            continue

    return additional


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
    target_queries: list[str] | None = None,
) -> list[dict[str, Any]]:
    """
    Multi-signal content discovery pipeline.

    Parallel Brave searches:
    1.  site:{domain}                          — own content
    2.  "{brand}" site:linkedin.com            — LinkedIn presence
    3.  "{brand}" site:reddit.com              — Reddit threads
    4.  "{brand}" site:medium.com              — Medium articles
    5.  "{brand}" site:youtube.com             — YouTube videos
    6.  "{brand}" site:substack.com            — Substack posts
    7.  intitle:"{brand}" -site:{domain}       — Pages with brand in title (press, blog)
    8.  "{brand}" -site:{domain}               — Exact-match catch-all
    9.  {brand} -site:{domain}                 — Broad no-quotes catch-all (deeper index)
    10. "{domain}" -site:{domain}              — Backlink discovery
    11. "{brand}" {sector} -site:{domain}      — Brand + sector keywords (if target_queries given)
    12. ({var1} OR {var2}) -site:{domain}      — Brand name legal variations
    13+. "{brand}" site:{news_site}            — Individual country-aware press sites

    Supplemental:
    +. Gemini Grounding for each target query  — Google's index (finds what Brave misses)

    Results are deduplicated, classified by Gemini, and tagged with platform.
    Returns list of {url, title, snippet, platform, contentType, confidence}.
    """
    domain = urlparse(website_url).netloc.lstrip("www.")
    lang = language[:2].lower()
    news_sites = _NEWS_SITES_BY_LANG.get(lang, _NEWS_SITES_FALLBACK)

    # Core parallel Brave queries
    queries: list[tuple[str, int]] = [
        (f"site:{domain}", 20),                                      # 1. own
        (f'"{brand_name}" site:linkedin.com', 10),                   # 2. LinkedIn
        (f'"{brand_name}" site:reddit.com', 10),                     # 3. Reddit
        (f'"{brand_name}" site:medium.com', 10),                     # 4. Medium
        (f'"{brand_name}" site:youtube.com', 10),                    # 5. YouTube
        (f'"{brand_name}" site:substack.com', 10),                   # 6. Substack
        (f'intitle:"{brand_name}" -site:{domain}', 20),              # 7. Title match (press/blog)
        (f'"{brand_name}" -site:{domain}', 20),                      # 8. Exact catch-all
        (f'{brand_name} -site:{domain}', 20),                        # 9. Broad catch-all
        (f'"{domain}" -site:{domain}', 10),                          # 10. Backlink discovery
    ]

    # Sector keywords query (only if target_queries provided)
    sector_keywords = _extract_sector_keywords(target_queries or [], brand_name)
    if sector_keywords:
        queries.append((f'"{brand_name}" {sector_keywords} -site:{domain}', 10))  # 11.

    # Brand name legal variations
    brand_variations = _generate_brand_variations(brand_name)
    if brand_variations:
        variation_parts = " OR ".join(f'"{v}"' for v in brand_variations[:2])
        queries.append((f'({variation_parts}) -site:{domain}', 10))              # 12.

    # Individual news site queries (no OR — each site searched separately)
    for news_site in news_sites[:5]:
        queries.append((f'"{brand_name}" site:{news_site}', 10))                 # 13+.

    log.info(f"Discovery: running {len(queries)} parallel Brave searches for {domain} (lang={lang})")

    all_batches = await asyncio.gather(*[_brave_search(q, c) for q, c in queries])

    # Deduplicate across all Brave batches (preserve order: own content first)
    seen: set[str] = set()
    all_results: list[dict] = []
    for batch in all_batches:
        for r in batch:
            if r["url"] and r["url"] not in seen:
                seen.add(r["url"])
                all_results.append(r)

    brave_count = len(all_results)

    # Supplemental: Gemini Grounding (Google's index — finds what Brave misses)
    if target_queries:
        gemini_results = await _discover_via_gemini_grounding(
            brand_name, target_queries, domain, seen
        )
        for gr in gemini_results:
            if gr["url"] not in seen:
                seen.add(gr["url"])
                all_results.append(gr)
        if gemini_results:
            log.info(f"Discovery: Gemini Grounding added {len(gemini_results)} URLs")

    if not all_results:
        log.warning(f"No results found for {domain}")
        return []

    log.info(
        f"Discovery: {brave_count} from Brave + {len(all_results) - brave_count} from Gemini "
        f"= {len(all_results)} unique URLs before classification"
    )

    # Classify in one Gemini call (cap at 80 to stay within token budget)
    classified = await _classify_with_gemini(all_results[:80], brand_name, domain)

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
