from __future__ import annotations

"""
Sitemap import pipeline.

Scarica sitemap.xml (o sitemap_index.xml) dal sito del progetto,
estrae tutti gli URL <loc>, filtra quelli del dominio corretto,
e li inserisce in `contents` come isConfirmed=true, source='sitemap'.
"""

import logging
import re
from urllib.parse import urljoin, urlparse

import httpx

log = logging.getLogger(__name__)

_MEDIA_EXTENSIONS = (
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".ico",
    ".pdf", ".zip", ".mp4", ".mp3", ".woff", ".woff2", ".css", ".js",
)

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; Visiblee/1.0; +https://visiblee.ai/bot)",
    "Accept": "application/xml, text/xml, */*",
}


def _extract_urls_from_xml(xml_text: str) -> list[str]:
    """Estrae tutti i valori <loc> da un testo XML (sitemap o sitemap index)."""
    return re.findall(r"<loc>\s*(https?://[^\s<]+)\s*</loc>", xml_text, re.IGNORECASE)


def _is_sitemap_index(xml_text: str) -> bool:
    return "<sitemapindex" in xml_text.lower()


def _is_same_domain(url: str, base_domain: str) -> bool:
    try:
        parsed = urlparse(url)
        host = parsed.netloc.lower().lstrip("www.")
        return host == base_domain or host.endswith("." + base_domain)
    except Exception:
        return False


def _is_media_file(url: str) -> bool:
    path = urlparse(url).path.lower()
    return any(path.endswith(ext) for ext in _MEDIA_EXTENSIONS)


async def _fetch_xml(client: httpx.AsyncClient, url: str) -> str | None:
    try:
        resp = await client.get(url, headers=_HEADERS, follow_redirects=True, timeout=15)
        if resp.status_code == 200:
            return resp.text
    except Exception as e:
        log.debug(f"Failed to fetch {url}: {e}")
    return None


async def _find_sitemap_urls(client: httpx.AsyncClient, website_url: str) -> list[str]:
    """
    Trova gli URL della sitemap con questa strategia:
    1. /sitemap.xml
    2. /sitemap_index.xml
    3. /sitemap-index.xml
    4. robots.txt → cerca Sitemap: header
    """
    base = website_url.rstrip("/")
    candidates = [
        f"{base}/sitemap.xml",
        f"{base}/sitemap_index.xml",
        f"{base}/sitemap-index.xml",
    ]

    # Prova robots.txt
    robots = await _fetch_xml(client, f"{base}/robots.txt")
    if robots:
        for line in robots.splitlines():
            if line.lower().startswith("sitemap:"):
                sm_url = line.split(":", 1)[1].strip()
                if sm_url.startswith("http"):
                    candidates.insert(0, sm_url)

    return candidates


async def run_sitemap_import(website_url: str) -> list[str]:
    """
    Scarica e analizza la sitemap del sito, restituisce la lista di URL da importare.
    Gestisce sitemap index (multi-level) e sitemap standard.
    """
    parsed_base = urlparse(website_url)
    base_domain = parsed_base.netloc.lower().lstrip("www.")

    collected_urls: list[str] = []

    async with httpx.AsyncClient() as client:
        sitemap_candidates = await _find_sitemap_urls(client, website_url)

        for sitemap_url in sitemap_candidates:
            xml = await _fetch_xml(client, sitemap_url)
            if not xml:
                continue

            if _is_sitemap_index(xml):
                # Sitemap index: contiene link ad altre sitemap
                child_sitemaps = _extract_urls_from_xml(xml)
                log.info(f"Sitemap index at {sitemap_url}: {len(child_sitemaps)} child sitemaps")
                for child_url in child_sitemaps[:20]:  # max 20 child sitemap
                    child_xml = await _fetch_xml(client, child_url)
                    if child_xml:
                        urls = _extract_urls_from_xml(child_xml)
                        collected_urls.extend(urls)
            else:
                urls = _extract_urls_from_xml(xml)
                collected_urls.extend(urls)
                log.info(f"Sitemap at {sitemap_url}: {len(urls)} URLs")

            if collected_urls:
                break  # Prima sitemap funzionante trovata

    # Filtra: stesso dominio, non media, no duplicati
    seen: set[str] = set()
    filtered: list[str] = []
    for url in collected_urls:
        url = url.strip()
        if url in seen:
            continue
        seen.add(url)
        if _is_same_domain(url, base_domain) and not _is_media_file(url):
            filtered.append(url)

    log.info(f"Sitemap import for {website_url}: {len(collected_urls)} raw → {len(filtered)} filtered")
    return filtered
