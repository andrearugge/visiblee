from __future__ import annotations

"""
Passage segmentation: split HTML into structured passage chunks.

Target: 134–167 words per passage (optimal for AI extraction per specs).
Produces { passageText, passageIndex, wordCount, heading } records
suitable for direct insertion into the passages table.
"""

from typing import Any

from bs4 import BeautifulSoup

MIN_WORDS = 30
MAX_WORDS = 300
TARGET_WORDS = 150


def segment_html(html: str) -> list[dict[str, Any]]:
    """
    Extract passage segments from HTML.

    Segments on heading boundaries and paragraph accumulation.
    Passages exceeding MAX_WORDS are split into TARGET_WORDS chunks.

    Returns list of:
        {
            "passageText": str,
            "passageIndex": int,
            "wordCount": int,
            "heading": str | None,  # nearest preceding heading
        }
    """
    soup = BeautifulSoup(html, "lxml")

    # Remove noise elements
    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "form"]):
        tag.decompose()

    raw_passages: list[dict[str, Any]] = []
    current_heading: str | None = None
    buffer: list[str] = []

    def flush() -> None:
        text = " ".join(buffer).strip()
        words = text.split()
        if len(words) >= MIN_WORDS:
            raw_passages.append(
                {
                    "passageText": text,
                    "wordCount": len(words),
                    "heading": current_heading,
                }
            )
        buffer.clear()

    for tag in soup.find_all(["h1", "h2", "h3", "h4", "p", "li"]):
        if tag.name in ("h1", "h2", "h3", "h4"):
            flush()
            current_heading = tag.get_text(strip=True) or None
        else:
            text = tag.get_text(separator=" ", strip=True)
            if not text:
                continue
            buffer.append(text)
            # Flush when buffer reaches target length
            if len(" ".join(buffer).split()) >= TARGET_WORDS:
                flush()

    flush()

    # Split oversized passages and assign final sequential indices
    final: list[dict[str, Any]] = []
    idx = 0

    for p in raw_passages:
        words = p["passageText"].split()
        if p["wordCount"] <= MAX_WORDS:
            final.append(
                {
                    "passageText": p["passageText"],
                    "passageIndex": idx,
                    "wordCount": p["wordCount"],
                    "heading": p["heading"],
                }
            )
            idx += 1
        else:
            # Split into TARGET_WORDS chunks
            for i in range(0, len(words), TARGET_WORDS):
                chunk_words = words[i : i + TARGET_WORDS]
                if len(chunk_words) < MIN_WORDS:
                    continue
                chunk = " ".join(chunk_words)
                final.append(
                    {
                        "passageText": chunk,
                        "passageIndex": idx,
                        "wordCount": len(chunk_words),
                        "heading": p["heading"],
                    }
                )
                idx += 1

    return final
