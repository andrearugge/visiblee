from __future__ import annotations

"""
Passage segmentation: split HTML into structured passage chunks.

Target: 134–167 words per passage (optimal for AI extraction per specs).
Produces records with heuristic signals for Citation Power scoring (v2):
- relative_position: where in the document the passage sits (0.0–1.0)
- entity_density: approximate % of named-entity tokens
- has_statistics: contains numeric data with context
- has_source_citation: contains attribution patterns
- is_answer_first: first sentence follows Definition Lead pattern
- is_question_heading: associated heading contains a question mark
"""

import re
from typing import Any

from bs4 import BeautifulSoup

MIN_WORDS = 30
MAX_WORDS = 300
TARGET_WORDS = 150

# ─── Heuristic signal helpers ────────────────────────────────────────────────

_STATS_PATTERN = re.compile(
    r'\b\d+[\.,]?\d*\s*(%|percent|million|billion|miliardi|milioni|euro|dollar|\$|€|×|x\s)',
    re.IGNORECASE,
)

_SOURCE_PATTERNS = [
    re.compile(p, re.IGNORECASE)
    for p in [
        r'according to', r'source:', r'\bstudy\b', r'\bresearch\b',
        r'\breport\b', r'\bsurvey\b', r'data from', r'found that',
        r'published (by|in)', r'secondo', r'fonte:', r'studio\b',
        r'ricerca\b', r'rapporto\b',
    ]
]

_ANSWER_FIRST_VERBS = re.compile(
    r'\b(is|are|was|were|è|sono)\b', re.IGNORECASE
)


def _calc_entity_density(text: str) -> float:
    """
    Approximate named-entity density using capitalization + acronym heuristic.
    Does NOT use an external NER model — kept fast and dependency-free.
    """
    words = text.split()
    if not words:
        return 0.0

    entity_count = 0
    for i, word in enumerate(words):
        clean = word.strip(".,;:!?\"'()-")
        if not clean:
            continue
        # Mid-sentence capitalized words (skip sentence starters)
        if i > 0 and words[i - 1][-1] not in '.!?':
            if clean[0].isupper() and len(clean) > 1:
                entity_count += 1
        # Acronyms (ALL CAPS, 2+ chars)
        if clean.isupper() and len(clean) >= 2:
            entity_count += 1

    return round(entity_count / len(words), 3)


def _has_statistics(text: str) -> bool:
    return bool(_STATS_PATTERN.search(text))


def _has_source_citation(text: str) -> bool:
    return any(p.search(text) for p in _SOURCE_PATTERNS)


def _is_answer_first(text: str) -> bool:
    """
    Check if the first sentence follows a Definition Lead pattern:
    - At least 8 words
    - Contains a linking verb (is/are/was/è/sono) in the first 15 words
    """
    first_sentence = text.split('.')[0] if text else ""
    words = first_sentence.split()
    if len(words) < 8:
        return False
    first_chunk = ' '.join(words[:15])
    return bool(_ANSWER_FIRST_VERBS.search(first_chunk))


# ─── Main segmentation ───────────────────────────────────────────────────────

def segment_html(html: str) -> list[dict[str, Any]]:
    """
    Extract passage segments from HTML with heuristic signals.

    Segments on heading boundaries and paragraph accumulation.
    Passages exceeding MAX_WORDS are split into TARGET_WORDS chunks.

    Returns list of:
        {
            "passageText": str,
            "passageIndex": int,
            "wordCount": int,
            "heading": str | None,          # nearest preceding heading
            "relativePosition": float,      # 0.0 (start) – 1.0 (end)
            "entityDensity": float,         # approx. named-entity ratio
            "hasStatistics": bool,
            "hasSourceCitation": bool,
            "isAnswerFirst": bool,
            "isQuestionHeading": bool,
        }
    """
    soup = BeautifulSoup(html, "lxml")

    # Remove noise elements
    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "form"]):
        tag.decompose()

    # Full text length for relative_position calculation
    full_text = soup.get_text(separator=" ", strip=True)
    total_chars = len(full_text) or 1

    raw_passages: list[dict[str, Any]] = []
    current_heading: str | None = None
    buffer: list[str] = []
    # Track character offset of the start of current buffer within full_text
    char_offset = 0
    last_flush_offset = 0

    def flush() -> None:
        nonlocal last_flush_offset
        text = " ".join(buffer).strip()
        words = text.split()
        if len(words) >= MIN_WORDS:
            raw_passages.append(
                {
                    "passageText": text,
                    "wordCount": len(words),
                    "heading": current_heading,
                    "char_offset": last_flush_offset,
                }
            )
        last_flush_offset = char_offset
        buffer.clear()

    for tag in soup.find_all(["h1", "h2", "h3", "h4", "p", "li"]):
        tag_text = tag.get_text(separator=" ", strip=True)
        if tag.name in ("h1", "h2", "h3", "h4"):
            flush()
            current_heading = tag_text or None
        else:
            if not tag_text:
                continue
            buffer.append(tag_text)
            char_offset += len(tag_text) + 1  # +1 for separator
            if len(" ".join(buffer).split()) >= TARGET_WORDS:
                flush()

    flush()

    # Split oversized passages and compute final signals
    final: list[dict[str, Any]] = []
    idx = 0

    for p in raw_passages:
        words = p["passageText"].split()

        if p["wordCount"] <= MAX_WORDS:
            chunks = [(p["passageText"], p["char_offset"])]
        else:
            chunks = []
            for i in range(0, len(words), TARGET_WORDS):
                chunk_words = words[i: i + TARGET_WORDS]
                if len(chunk_words) < MIN_WORDS:
                    continue
                # Approximate offset for sub-chunks
                sub_offset = p["char_offset"] + i * 6  # rough avg word+space
                chunks.append((" ".join(chunk_words), sub_offset))

        for chunk_text, offset in chunks:
            chunk_words = chunk_text.split()
            rel_pos = round(min(offset / total_chars, 1.0), 3)

            final.append(
                {
                    "passageText": chunk_text,
                    "passageIndex": idx,
                    "wordCount": len(chunk_words),
                    "heading": p["heading"],
                    "relativePosition": rel_pos,
                    "entityDensity": _calc_entity_density(chunk_text),
                    "hasStatistics": _has_statistics(chunk_text),
                    "hasSourceCitation": _has_source_citation(chunk_text),
                    "isAnswerFirst": _is_answer_first(chunk_text),
                    "isQuestionHeading": "?" in (p["heading"] or ""),
                }
            )
            idx += 1

    return final
