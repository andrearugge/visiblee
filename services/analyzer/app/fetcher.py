from __future__ import annotations

"""
Content fetching: download a URL and extract clean text + metadata.
Separate from crawler.py (preview) — this version is for the full pipeline
and persists rawText to the database.

v2 additions:
- raw_html: original HTML preserved for schema markup extraction
- schema_markup: extracted JSON-LD schemas
- has_article_schema / has_faq_schema / has_org_schema: boolean flags
- date_modified_schema: dateModified from Article schema
- robots_txt_blocks: list of AI bots blocked by the domain's robots.txt
"""

import json
import logging
import re
from typing import Any
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

log = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; Visiblee/1.0; +https://visiblee.ai)"
}

MIN_WORD_COUNT = 50

# AI bots to check in robots.txt
AI_BOTS = ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended", "anthropic-ai", "Omgilibot"]

# In-memory cache: domain -> list of blocked bots
_robots_cache: dict[str, list[str]] = {}


def _is_schema_type(schema: dict | list, target_type: str) -> bool:
    """Check if a JSON-LD object matches a schema type (handles @type as string or list)."""
    if isinstance(schema, list):
        return any(_is_schema_type(s, target_type) for s in schema)
    schema_type = schema.get("@type", "")
    if isinstance(schema_type, list):
        return target_type in schema_type
    return schema_type == target_type


def extract_schema_markup(html: str) -> dict[str, Any]:
    """
    Extract JSON-LD schema markup from HTML.
    Returns flags and structured data for DB storage.
    """
    soup = BeautifulSoup(html, "lxml")
    schemas: list[dict] = []

    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
            if isinstance(data, list):
                schemas.extend(data)
            elif isinstance(data, dict):
                schemas.append(data)
        except (json.JSONDecodeError, TypeError):
            continue

    has_article = any(_is_schema_type(s, "Article") for s in schemas)
    has_faq = any(_is_schema_type(s, "FAQPage") for s in schemas)
    has_org = any(_is_schema_type(s, "Organization") for s in schemas)

    date_modified: str | None = None
    for s in schemas:
        if _is_schema_type(s, "Article") and "dateModified" in s:
            date_modified = s["dateModified"]
            break

    return {
        "schemas": schemas,
        "has_article_schema": has_article,
        "has_faq_schema": has_faq,
        "has_org_schema": has_org,
        "date_modified_schema": date_modified,
    }


async def check_robots_txt(domain: str) -> list[str]:
    """
    Fetch robots.txt for a domain and return list of AI bots that are blocked.
    Results are cached in memory per domain.
    """
    if domain in _robots_cache:
        return _robots_cache[domain]

    blocked: list[str] = []
    url = f"https://{domain}/robots.txt"

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=HEADERS, timeout=8, follow_redirects=True)
            if resp.status_code != 200:
                _robots_cache[domain] = blocked
                return blocked

        text = resp.text
        # Simple parser: look for User-agent: <Bot> followed by Disallow: /
        current_agents: list[str] = []
        for line in text.splitlines():
            line = line.strip()
            if line.lower().startswith("user-agent:"):
                agent = line.split(":", 1)[1].strip()
                current_agents = [agent]
            elif line.lower().startswith("disallow:"):
                path = line.split(":", 1)[1].strip()
                if path in ("/", "/*"):
                    for bot in AI_BOTS:
                        if any(bot.lower() == a.lower() or a == "*" for a in current_agents):
                            if bot not in blocked:
                                blocked.append(bot)
            elif line == "":
                current_agents = []

    except Exception as e:
        log.debug(f"robots.txt fetch failed for {domain}: {e}")

    _robots_cache[domain] = blocked
    return blocked


async def fetch_url(url: str) -> dict[str, Any] | None:
    """
    Fetch a single URL and return extracted content.

    Returns:
        {
            "html": str,                    # cleaned HTML (for segmentation)
            "raw_html": str,                # original HTML (for schema extraction)
            "title": str | None,
            "raw_text": str,                # clean text (for storage)
            "word_count": int,
            "schema_markup": list,          # raw JSON-LD schemas
            "has_article_schema": bool,
            "has_faq_schema": bool,
            "has_org_schema": bool,
            "date_modified_schema": str | None,
            "robots_txt_blocks": list[str], # AI bots blocked by robots.txt
        }
        or None if fetch fails or content is too short.
    """
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(url, headers=HEADERS, timeout=15, follow_redirects=True)
            if resp.status_code != 200:
                log.debug(f"Fetch {url}: HTTP {resp.status_code}")
                return None
            if "html" not in resp.headers.get("content-type", ""):
                log.debug(f"Fetch {url}: not HTML")
                return None

            raw_html = resp.text
            soup = BeautifulSoup(raw_html, "lxml")

            # Extract title before stripping tags
            title_tag = soup.find("title")
            title = title_tag.get_text(strip=True) if title_tag else None

            # Extract schema markup from original HTML
            schema_data = extract_schema_markup(raw_html)

            # Strip noise for raw_text storage
            for tag in soup(["script", "style", "nav", "footer", "header", "aside", "form"]):
                tag.decompose()
            raw_text = soup.get_text(separator="\n", strip=True)
            word_count = len(raw_text.split())

            if word_count < MIN_WORD_COUNT:
                log.debug(f"Fetch {url}: too short ({word_count} words)")
                return None

            # Check robots.txt (cached per domain)
            domain = urlparse(url).netloc
            robots_blocks = await check_robots_txt(domain)

            return {
                "html": raw_html,           # segmenter still uses this field name
                "raw_html": raw_html,
                "title": title,
                "raw_text": raw_text,
                "word_count": word_count,
                "schema_markup": schema_data["schemas"],
                "has_article_schema": schema_data["has_article_schema"],
                "has_faq_schema": schema_data["has_faq_schema"],
                "has_org_schema": schema_data["has_org_schema"],
                "date_modified_schema": schema_data["date_modified_schema"],
                "robots_txt_blocks": robots_blocks,
            }

        except httpx.TimeoutException:
            log.warning(f"Fetch {url}: timeout")
            return None
        except Exception as e:
            log.warning(f"Fetch {url}: {e}")
            return None
