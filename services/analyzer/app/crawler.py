from __future__ import annotations

"""
Web crawling: Brave Search API + BeautifulSoup page fetching/chunking.
"""

import re
import asyncio
from urllib.parse import urlparse
from typing import Any

import httpx
from bs4 import BeautifulSoup

from .config import config

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; Visiblee/1.0; +https://visiblee.ai)"
    )
}

# Passage target: 150 words, min 50
TARGET_WORDS = 150
MIN_WORDS = 50


def _extract_text_passages(html: str, url: str) -> list[dict[str, Any]]:
    """Parse HTML and split into passages."""
    soup = BeautifulSoup(html, "lxml")

    # Remove noise
    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "form"]):
        tag.decompose()

    passages: list[dict[str, Any]] = []
    current_heading: str | None = None
    buffer: list[str] = []

    def flush(heading: str | None) -> None:
        text = " ".join(buffer).strip()
        words = text.split()
        if len(words) >= MIN_WORDS:
            passages.append({
                "passage_text": text,
                "word_count": len(words),
                "heading": heading,
                "url": url,
            })
        buffer.clear()

    for tag in soup.find_all(["h1", "h2", "h3", "h4", "p", "li"]):
        if tag.name in ("h1", "h2", "h3", "h4"):
            flush(current_heading)
            current_heading = tag.get_text(strip=True)
        else:
            text = tag.get_text(separator=" ", strip=True)
            if not text:
                continue
            buffer.append(text)
            if len(" ".join(buffer).split()) >= TARGET_WORDS:
                flush(current_heading)

    flush(current_heading)
    return passages


async def fetch_page(client: httpx.AsyncClient, url: str) -> dict[str, Any] | None:
    """Fetch a single page and return metadata + passages."""
    try:
        resp = await client.get(url, headers=HEADERS, timeout=10, follow_redirects=True)
        if resp.status_code != 200:
            return None
        content_type = resp.headers.get("content-type", "")
        if "html" not in content_type:
            return None
        passages = _extract_text_passages(resp.text, url)
        title_match = re.search(r"<title[^>]*>(.*?)</title>", resp.text, re.IGNORECASE | re.DOTALL)
        title = title_match.group(1).strip() if title_match else url
        return {
            "url": url,
            "title": title,
            "passages": passages,
            "word_count": sum(p["word_count"] for p in passages),
        }
    except Exception:
        return None


async def brave_search(query: str, count: int = 20) -> list[str]:
    """Search Brave and return list of URLs."""
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
                params={"q": query, "count": count},
                timeout=10,
            )
            if resp.status_code != 200:
                return []
            data = resp.json()
            return [r["url"] for r in data.get("web", {}).get("results", [])]
        except Exception:
            return []


async def crawl_website(website_url: str) -> list[dict[str, Any]]:
    """Crawl a website: site: search + fetch top pages."""
    domain = urlparse(website_url).netloc
    query = f"site:{domain}"

    urls = await brave_search(query, count=20)

    # Always include the homepage
    if website_url not in urls:
        urls.insert(0, website_url)

    # Limit to MAX_PAGES_TO_FETCH
    urls = urls[: config.MAX_PAGES_TO_FETCH]

    async with httpx.AsyncClient() as client:
        tasks = [fetch_page(client, url) for url in urls]
        results = await asyncio.gather(*tasks)

    return [r for r in results if r is not None]


async def search_cross_platform(brand_name: str) -> dict[str, list[str]]:
    """Search brand presence on key platforms."""
    platforms = {
        "linkedin": f"{brand_name} site:linkedin.com",
        "medium": f"{brand_name} site:medium.com",
        "reddit": f"{brand_name} site:reddit.com",
        "youtube": f"{brand_name} site:youtube.com",
        "substack": f"{brand_name} site:substack.com",
    }

    results: dict[str, list[str]] = {}
    for platform, query in platforms.items():
        urls = await brave_search(query, count=5)
        results[platform] = urls

    return results
