from __future__ import annotations

"""
Competitor analysis pipeline.

For each competitor:
1. Load competitor (websiteUrl)
2. Crawl up to 5 pages (homepage + linked pages) via fetcher.py
3. Segment each page into passages via segmenter.py
4. Score passages with passage_quality (Claude) — same fn as full pipeline
5. Save CompetitorContent + CompetitorPassage records
6. Compute avgPassageScore across all scored passages
7. Update competitor.isConfirmed = true, avgPassageScore
"""

import asyncio
import logging
from typing import Any

from .fetcher import fetch_url
from .segmenter import segment_html
from .scoring import score_passage_quality

log = logging.getLogger(__name__)

MAX_PAGES = 5


async def _crawl_competitor(website_url: str) -> list[dict[str, Any]]:
    """Fetch homepage + up to MAX_PAGES-1 linked pages. Returns list of fetch results."""
    results: list[dict[str, Any]] = []

    homepage = await fetch_url(website_url)
    if not homepage:
        return results

    results.append({"url": website_url, **homepage})

    # Extract internal links from homepage HTML
    try:
        from bs4 import BeautifulSoup
        from urllib.parse import urljoin, urlparse

        soup = BeautifulSoup(homepage["html"], "html.parser")
        base = urlparse(website_url)
        seen = {website_url}
        links: list[str] = []

        for a in soup.find_all("a", href=True):
            href = a["href"].strip()
            full = urljoin(website_url, href)
            parsed = urlparse(full)
            if (
                parsed.scheme in ("http", "https")
                and parsed.netloc == base.netloc
                and full not in seen
                and not any(full.endswith(ext) for ext in (".pdf", ".jpg", ".png", ".zip"))
            ):
                links.append(full)
                seen.add(full)
                if len(links) >= MAX_PAGES - 1:
                    break

        # Fetch linked pages concurrently
        async def safe_fetch(url: str) -> dict[str, Any] | None:
            try:
                r = await fetch_url(url)
                if r:
                    return {"url": url, **r}
            except Exception:
                pass
            return None

        fetched = await asyncio.gather(*[safe_fetch(u) for u in links])
        results.extend(r for r in fetched if r is not None)

    except Exception as e:
        log.warning(f"Link extraction failed for {website_url}: {e}")

    return results


async def run_competitor_pipeline(conn, project_id: str, competitor_id: str) -> None:
    """Crawl, score, and persist results for one competitor."""
    # Load competitor
    with conn.cursor() as cur:
        cur.execute(
            'SELECT id, "websiteUrl" FROM competitors WHERE id = %s AND "projectId" = %s',
            (competitor_id, project_id),
        )
        competitor = cur.fetchone()

    if not competitor or not competitor["websiteUrl"]:
        log.warning(f"Competitor {competitor_id} not found or has no URL")
        return

    website_url = competitor["websiteUrl"]
    log.info(f"Crawling competitor {competitor_id}: {website_url}")

    pages = await _crawl_competitor(website_url)
    if not pages:
        log.warning(f"No pages fetched for competitor {competitor_id}")
        # Still mark as confirmed with no score
        with conn.cursor() as cur:
            cur.execute(
                'UPDATE competitors SET "isConfirmed" = true WHERE id = %s',
                (competitor_id,),
            )
        conn.commit()
        return

    # Build passage list for scoring
    all_passages: list[dict[str, Any]] = []
    page_data: list[dict[str, Any]] = []

    for page in pages:
        passages = segment_html(page["html"])
        page_data.append({
            "url": page["url"],
            "title": page.get("title"),
            "raw_text": page.get("raw_text", ""),
            "passages": passages,
        })
        for p in passages:
            all_passages.append({
                "passage_text": p["passageText"],
                "word_count": p["wordCount"],
                "page_url": page["url"],
                "passage_index": p["passageIndex"],
            })

    # Score passages
    avg_score, scored_passages = await score_passage_quality(all_passages)

    # Build score lookup by (page_url, passage_index)
    score_lookup: dict[tuple[str, int], float] = {}
    for sp in scored_passages:
        key = (sp.get("page_url", ""), sp.get("passage_index", -1))
        score_lookup[key] = sp.get("overall_score", 0.0)

    # Persist to DB
    with conn.cursor() as cur:
        for page in page_data:
            # Insert CompetitorContent
            cur.execute(
                """
                INSERT INTO competitor_contents (
                    id, "competitorId", url, title, "rawText", "createdAt"
                )
                VALUES (gen_random_uuid(), %s, %s, %s, %s, NOW())
                ON CONFLICT DO NOTHING
                RETURNING id
                """,
                (
                    competitor_id,
                    page["url"],
                    page.get("title"),
                    page["raw_text"][:10000] if page.get("raw_text") else None,
                ),
            )
            row = cur.fetchone()
            if not row:
                # conflict — skip passages
                continue
            content_id = row["id"]

            # Insert CompetitorPassage records
            for p in page["passages"]:
                key = (page["url"], p["passageIndex"])
                passage_score = score_lookup.get(key)
                cur.execute(
                    """
                    INSERT INTO competitor_passages (
                        id, "competitorContentId", "passageText",
                        "passageIndex", "wordCount", "overallScore", "createdAt"
                    )
                    VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, NOW())
                    """,
                    (
                        content_id,
                        p["passageText"],
                        p["passageIndex"],
                        p.get("wordCount"),
                        passage_score,
                    ),
                )

        # Update competitor: set isConfirmed + avgPassageScore
        cur.execute(
            """
            UPDATE competitors
            SET "isConfirmed" = true, "avgPassageScore" = %s
            WHERE id = %s
            """,
            (avg_score, competitor_id),
        )

    conn.commit()
    log.info(
        f"Competitor {competitor_id}: {len(pages)} pages, "
        f"{len(all_passages)} passages, avg score={avg_score:.2f}"
    )
