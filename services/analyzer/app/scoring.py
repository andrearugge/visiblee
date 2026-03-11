from __future__ import annotations

"""
Scoring logic for all 6 AI Readiness dimensions.
"""

import re
import asyncio
from typing import Any

from .config import config

try:
    import anthropic
    _claude = anthropic.AsyncAnthropic(api_key=config.ANTHROPIC_API_KEY) if config.ANTHROPIC_API_KEY else None
except ImportError:
    _claude = None

try:
    from google import genai as google_genai
    _gemini_client = google_genai.Client(api_key=config.GOOGLE_AI_API_KEY) if config.GOOGLE_AI_API_KEY else None
except ImportError:
    _gemini_client = None


# ── Fanout query generation ────────────────────────────────────────────────

async def generate_fanout_queries(
    target_queries: list[str],
    brand_name: str,
    language: str,
) -> list[str]:
    """Generate N fanout queries per target query using Gemini Flash."""
    if not _gemini_client:
        return target_queries

    n = config.FANOUT_PER_QUERY
    lang_instruction = "in Italian" if language == "it" else "in English"
    all_queries: list[str] = list(target_queries)

    async def expand_query(query: str) -> list[str]:
        prompt = (
            f"Generate {n} diverse search queries {lang_instruction} that are semantically related to: '{query}'\n"
            f"Context: brand '{brand_name}'\n"
            f"Include: related questions, implicit needs, comparative queries, exploratory variations.\n"
            f"Return ONLY the queries, one per line, no numbering, no extra text."
        )
        try:
            response = await _gemini_client.aio.models.generate_content(
                model="gemini-2.0-flash", contents=prompt
            )
            lines = [l.strip() for l in response.text.strip().splitlines() if l.strip()]
            return lines[:n]
        except Exception:
            return []

    tasks = [expand_query(q) for q in target_queries]
    results = await asyncio.gather(*tasks)
    for expanded in results:
        all_queries.extend(expanded)

    return all_queries


# ── Passage quality scoring ────────────────────────────────────────────────

_PASSAGE_QUALITY_PROMPT = """Score this passage on 5 criteria (0.0–1.0 each):
1. self_containedness: Can it be understood without context?
2. claim_clarity: Are claims specific and unambiguous?
3. information_density: High signal-to-noise ratio?
4. completeness: Does it fully address its topic?
5. verifiability: Does it cite facts, data, or named sources?

Passage:
{passage}

Respond ONLY with JSON: {{"self_containedness": 0.0, "claim_clarity": 0.0, "information_density": 0.0, "completeness": 0.0, "verifiability": 0.0}}"""


async def score_passage_quality(passages: list[dict[str, Any]]) -> tuple[float, list[dict[str, Any]]]:
    """Score up to 2 best passages per page using Claude Sonnet."""
    if not passages or not _claude:
        return 0.5, []

    # Select top passages by word count (proxy for richness), max 10 total
    candidates = sorted(passages, key=lambda p: p.get("word_count", 0), reverse=True)[:10]
    scored: list[dict[str, Any]] = []

    async def score_one(passage: dict[str, Any]) -> dict[str, Any] | None:
        try:
            text = passage["passage_text"][:2000]  # truncate for cost
            msg = await _claude.messages.create(
                model="claude-sonnet-4-5",
                max_tokens=200,
                messages=[{"role": "user", "content": _PASSAGE_QUALITY_PROMPT.format(passage=text)}],
            )
            import json
            raw = msg.content[0].text.strip()
            # Extract JSON from response
            json_match = re.search(r"\{[^}]+\}", raw)
            if not json_match:
                return None
            criteria = json.loads(json_match.group())
            overall = sum(criteria.values()) / len(criteria)
            return {
                **passage,
                "scores": criteria,
                "overall_score": round(overall, 3),
            }
        except Exception:
            return None

    # Batch with semaphore to avoid rate limits
    sem = asyncio.Semaphore(3)

    async def bounded(p: dict[str, Any]) -> dict[str, Any] | None:
        async with sem:
            return await score_one(p)

    results = await asyncio.gather(*[bounded(p) for p in candidates])
    scored = [r for r in results if r is not None]

    if not scored:
        return 0.5, []

    avg = sum(s["overall_score"] for s in scored) / len(scored)
    return round(avg, 3), scored


# ── Chunkability score ────────────────────────────────────────────────────

def score_chunkability(pages: list[dict[str, Any]]) -> float:
    """
    Heuristic chunkability:
    - Paragraph word count 134–167 = optimal (1.0), outside = penalty
    - Presence of headings
    - Answer-first structure (first sentence contains key noun)
    """
    if not pages:
        return 0.5

    all_passages = [p for page in pages for p in page.get("passages", [])]
    if not all_passages:
        return 0.5

    scores: list[float] = []
    for passage in all_passages:
        wc = passage.get("word_count", 0)
        # Word count score
        if 134 <= wc <= 167:
            wc_score = 1.0
        elif 80 <= wc < 134 or 167 < wc <= 250:
            wc_score = 0.7
        else:
            wc_score = 0.4

        # Heading presence
        heading_score = 0.8 if passage.get("heading") else 0.4

        # Answer-first: first sentence should be substantive (>8 words)
        text = passage.get("passage_text", "")
        first_sentence = text.split(".")[0] if text else ""
        answer_first_score = 0.8 if len(first_sentence.split()) >= 8 else 0.4

        scores.append((wc_score * 0.5) + (heading_score * 0.25) + (answer_first_score * 0.25))

    return round(sum(scores) / len(scores), 3)


# ── Entity coherence score ─────────────────────────────────────────────────

def score_entity_coherence(pages: list[dict[str, Any]], brand_name: str) -> float:
    """
    Simplified entity coherence:
    - Brand name appears consistently across pages
    - Key terms reused across multiple pages
    """
    if not pages:
        return 0.5

    brand_lower = brand_name.lower()
    all_texts: list[str] = []
    brand_mentions: list[int] = []

    for page in pages:
        page_text = " ".join(
            p["passage_text"] for p in page.get("passages", [])
        ).lower()
        all_texts.append(page_text)
        brand_mentions.append(page_text.count(brand_lower))

    # Brand presence score
    pages_with_brand = sum(1 for m in brand_mentions if m > 0)
    brand_score = pages_with_brand / len(pages) if pages else 0.0

    # Term consistency: extract top words, check cross-page reuse
    word_counts: dict[str, int] = {}
    for text in all_texts:
        words = re.findall(r"\b[a-z]{4,}\b", text)
        for w in set(words):  # unique per page
            word_counts[w] = word_counts.get(w, 0) + 1

    # Words appearing in ≥2 pages
    consistent_terms = sum(1 for v in word_counts.values() if v >= 2)
    term_score = min(consistent_terms / 20, 1.0)  # saturates at 20 shared terms

    return round((brand_score * 0.6) + (term_score * 0.4), 3)


# ── Cross-platform score ───────────────────────────────────────────────────

def score_cross_platform(platform_results: dict[str, list[str]]) -> float:
    """Score based on how many platforms have results."""
    if not platform_results:
        return 0.0

    total_platforms = len(platform_results)
    platforms_with_presence = sum(1 for urls in platform_results.values() if urls)
    return round(platforms_with_presence / total_platforms, 3)


# ── Insight generation ─────────────────────────────────────────────────────

async def generate_insights(
    brand_name: str,
    scores: dict[str, float],
    language: str,
) -> list[str]:
    """Generate 3–4 insight bullets using Claude or Gemini."""
    lang_instruction = "in Italian" if language == "it" else "in English"

    score_summary = "\n".join(
        f"- {k.replace('_', ' ').title()}: {v:.0%}" for k, v in scores.items()
    )

    prompt = (
        f"You are an AI visibility analyst. Based on these scores for brand '{brand_name}':\n"
        f"{score_summary}\n\n"
        f"Write 3-4 specific, actionable insight bullets {lang_instruction}.\n"
        f"Each bullet should explain what the score means and the most important action.\n"
        f"Be specific. Start each bullet with a strong verb. No markdown, plain text, one bullet per line starting with '•'."
    )

    if _claude:
        try:
            msg = await _claude.messages.create(
                model="claude-sonnet-4-5",
                max_tokens=400,
                messages=[{"role": "user", "content": prompt}],
            )
            text = msg.content[0].text.strip()
            bullets = [l.strip().lstrip("•").strip() for l in text.splitlines() if l.strip().startswith("•")]
            if bullets:
                return bullets[:4]
        except Exception:
            pass

    if _gemini_client:
        try:
            response = await _gemini_client.aio.models.generate_content(
                model="gemini-2.0-flash", contents=prompt
            )
            text = response.text.strip()
            bullets = [l.strip().lstrip("•").strip() for l in text.splitlines() if l.strip().startswith("•")]
            if bullets:
                return bullets[:4]
        except Exception:
            pass

    return [
        f"Your AI Readiness Score is {scores.get('ai_readiness_score', 0):.0%}.",
        "Focus on improving content chunkability and passage quality.",
        "Expand your presence across AI-indexed platforms.",
    ]


# ── Composite AI Readiness Score ───────────────────────────────────────────

SCORE_WEIGHTS = {
    "fanout_coverage_score": 0.25,
    "passage_quality_score": 0.25,
    "chunkability_score": 0.20,
    "entity_coherence_score": 0.15,
    "cross_platform_score": 0.15,
}


def compute_ai_readiness(scores: dict[str, float]) -> float:
    """Weighted composite of the 5 sub-scores → AI Readiness Score."""
    total = sum(
        scores.get(k, 0.0) * w for k, w in SCORE_WEIGHTS.items()
    )
    return round(min(total, 1.0), 3)
