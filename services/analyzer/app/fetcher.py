from __future__ import annotations

"""
Content fetching: download a URL and extract clean text + metadata.
Separate from crawler.py (preview) — this version is for the full pipeline
and persists rawText to the database.
"""

import logging
from typing import Any

import httpx
from bs4 import BeautifulSoup

log = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; Visiblee/1.0; +https://visiblee.ai)"
}

MIN_WORD_COUNT = 50


async def fetch_url(url: str) -> dict[str, Any] | None:
    """
    Fetch a single URL and return extracted content.

    Returns:
        {
            "html": str,           # raw HTML (needed for segmentation)
            "title": str | None,
            "raw_text": str,       # clean text (for storage)
            "word_count": int,
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

            html = resp.text
            soup = BeautifulSoup(html, "lxml")

            # Extract title
            title_tag = soup.find("title")
            title = title_tag.get_text(strip=True) if title_tag else None

            # Strip noise for raw_text storage
            for tag in soup(["script", "style", "nav", "footer", "header", "aside", "form"]):
                tag.decompose()
            raw_text = soup.get_text(separator="\n", strip=True)
            word_count = len(raw_text.split())

            if word_count < MIN_WORD_COUNT:
                log.debug(f"Fetch {url}: too short ({word_count} words)")
                return None

            return {
                "html": html,
                "title": title,
                "raw_text": raw_text,
                "word_count": word_count,
            }

        except httpx.TimeoutException:
            log.warning(f"Fetch {url}: timeout")
            return None
        except Exception as e:
            log.warning(f"Fetch {url}: {e}")
            return None
