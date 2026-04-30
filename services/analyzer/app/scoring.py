from __future__ import annotations

"""
Scoring logic for the 5 AI Readiness dimensions (v2).

Scoring engine philosophy (v2):
- Citation Power, Extractability, Entity Authority, Source Authority
  are FULLY HEURISTIC — zero LLM calls.
- Claude / Gemini are reserved for insight generation and recommendations
  where language model reasoning adds real value.
- Fanout query generation still uses Gemini (taxonomy-aware expansion).
"""

import json
import re
import asyncio
from datetime import datetime
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

_FANOUT_VALID_TYPES = frozenset({"related", "implicit", "comparative", "exploratory", "decisional", "recent"})


async def generate_fanout_queries(
    target_queries: list[str],
    brand_name: str,
    language: str,
) -> list[str]:
    """Generate fanout queries. Returns flat list of query texts (for preview pipeline)."""
    grouped = await generate_fanout_queries_grouped(target_queries, brand_name, language)
    texts: list[str] = list(target_queries)
    for expanded in grouped:
        texts.extend(item["text"] for item in expanded)
    return texts


async def generate_fanout_queries_grouped(
    target_queries: list[str],
    brand_name: str,
    language: str,
) -> list[list[dict]]:
    """
    Generate N fanout queries per target using Gemini Flash.
    Returns list[list[dict]] where each dict is {"text": str, "type": str}.

    Types: related, implicit, comparative, exploratory, decisional, recent
    Fallback type "generated" is used when JSON parsing fails.
    """
    if not _gemini_client:
        return [[] for _ in target_queries]

    n = config.FANOUT_PER_QUERY
    _LANG_NAMES = {"it": "Italian", "en": "English", "es": "Spanish", "fr": "French", "de": "German", "pt": "Portuguese"}
    lang_instruction = f"in {_LANG_NAMES.get(language[:2].lower(), 'English')}"
    current_year = datetime.now().year

    async def expand_query(query: str) -> list[dict]:
        prompt = (
            f"Generate {n} diverse search queries {lang_instruction} semantically related to: '{query}'\n"
            f"Context: brand '{brand_name}'\n"
            f"Assign each query one of these types: related, implicit, comparative, exploratory, decisional, recent\n"
            f"(Include at least 1 'recent' query mentioning {current_year})\n"
            f"Return ONLY a JSON array, no markdown, no extra text:\n"
            f'[{{"text": "query here", "type": "related"}}, ...]'
        )
        response_text = ""
        try:
            response = await _gemini_client.aio.models.generate_content(
                model="gemini-2.5-flash", contents=prompt
            )
            response_text = response.text.strip()
            # Strip markdown code fences if present
            raw = re.sub(r'^```(?:json)?\s*', '', response_text)
            raw = re.sub(r'\s*```$', '', raw).strip()
            items = json.loads(raw)
            result: list[dict] = []
            for item in items[:n]:
                if isinstance(item, dict) and "text" in item:
                    qtype = item.get("type", "generated")
                    if qtype not in _FANOUT_VALID_TYPES:
                        qtype = "generated"
                    result.append({"text": str(item["text"]), "type": qtype})
            return result
        except Exception:
            # Fallback: plain lines → type "generated"
            lines = [ln.strip() for ln in response_text.splitlines() if ln.strip() and not ln.strip().startswith(('[', '{', '`'))]
            return [{"text": ln, "type": "generated"} for ln in lines[:n]]

    results = await asyncio.gather(*[expand_query(q) for q in target_queries])
    return list(results)


# ── Citation Power score (ex passage quality) — fully heuristic ───────────

def score_citation_power(contents: list[dict[str, Any]]) -> tuple[float, list[dict[str, Any]]]:
    """
    Score citation power across all passages from all confirmed contents.
    Replaces the old Claude-based score_passage_quality — zero LLM calls.

    Sub-criteria and weights:
        position_score          25%  — early passages score higher
        entity_density          20%  — normalized against benchmark (0.206)
        statistical_specificity 20%  — contains numeric data with context
        definiteness            15%  — answer-first sentence structure
        answer_first            10%  — explicit definition lead
        source_citation         10%  — attribution to named sources

    Returns (project_score, per_passage_scores).
    """
    all_scored: list[dict[str, Any]] = []

    for content in contents:
        for passage in content.get("passages", []):
            pos = passage.get("relativePosition") or passage.get("relative_position", 0.5)

            # Position score: first 30% = 1.0, mid = 0.7, last 30% = 0.55
            if pos <= 0.30:
                position_score = 1.0
            elif pos <= 0.70:
                position_score = 0.7
            else:
                position_score = 0.55

            # Entity density: normalize against empirical benchmark
            ed = passage.get("entityDensity") or passage.get("entity_density", 0.0)
            entity_score = min(ed / config.ENTITY_DENSITY_BENCHMARK, 1.0) if ed else 0.0

            # Statistical specificity
            has_stats = passage.get("hasStatistics") or passage.get("has_statistics", False)
            stat_score = 0.9 if has_stats else 0.2

            # Definiteness (proxy: answer-first + implied directness)
            is_answer = passage.get("isAnswerFirst") or passage.get("is_answer_first", False)
            def_score = 0.85 if is_answer else 0.3

            # Answer-first structure
            af_score = 0.9 if is_answer else 0.3

            # Source citation
            has_src = passage.get("hasSourceCitation") or passage.get("has_source_citation", False)
            sc_score = 0.9 if has_src else 0.2

            overall = round(
                position_score * 0.25
                + entity_score  * 0.20
                + stat_score    * 0.20
                + def_score     * 0.15
                + af_score      * 0.10
                + sc_score      * 0.10,
                3,
            )

            all_scored.append({
                **passage,
                "content_id": content.get("id"),
                "scores": {
                    "position_score":          round(position_score, 3),
                    "entity_density":          round(entity_score, 3),
                    "statistical_specificity": round(stat_score, 3),
                    "definiteness":            round(def_score, 3),
                    "answer_first":            round(af_score, 3),
                    "source_citation":         round(sc_score, 3),
                },
                "overall_score": overall,
            })

    if not all_scored:
        return 0.5, []

    avg = sum(s["overall_score"] for s in all_scored) / len(all_scored)
    return round(avg, 3), all_scored


# ── Entity Authority score (ex entity coherence) ───────────────────────────

def score_entity_authority(
    contents: list[dict[str, Any]],
    brand_name: str,
    schema_data: dict[str, Any] | None = None,
    discovery_stats: dict[str, int] | None = None,
) -> float:
    """
    Score entity authority — how clearly the brand is represented as a
    distinct, authoritative entity in AI knowledge bases.

    Sub-criteria and weights:
        kg_presence             30%  — links to Wikipedia/Wikidata via schema sameAs
        cross_web_corroboration 25%  — mention content vs own content ratio
        entity_density_avg      20%  — average entity density across passages
        term_consistency        15%  — key terms reused across multiple pages
        entity_home_strength    10%  — schema Organization + sameAs quality
    """
    if not contents:
        return 0.5

    schema_data = schema_data or {}
    discovery_stats = discovery_stats or {}

    brand_lower = brand_name.lower()

    # — kg_presence: sameAs links to Wikipedia / Wikidata
    org_schemas = [s for s in schema_data.get("schemas", []) if _is_schema_type(s, "Organization")]
    same_as_links: list[str] = []
    for org in org_schemas:
        raw = org.get("sameAs", [])
        if isinstance(raw, str):
            same_as_links.append(raw)
        elif isinstance(raw, list):
            same_as_links.extend(raw)

    kg_links = sum(
        1 for link in same_as_links
        if "wikipedia.org" in link or "wikidata.org" in link
    )
    kg_presence = min(kg_links * 0.5, 1.0)

    # — cross_web_corroboration: mention / (own + mention) ratio
    own_count = max(discovery_stats.get("own_count", len(contents)), 1)
    mention_count = discovery_stats.get("mention_count", 0)
    corroboration = mention_count / (own_count + mention_count) if (own_count + mention_count) else 0.0

    # — entity_density_avg across all passages
    densities = [
        p.get("entityDensity") or p.get("entity_density", 0.0)
        for c in contents
        for p in c.get("passages", [])
    ]
    ed_avg = sum(densities) / len(densities) if densities else 0.0
    entity_density_score = min(ed_avg / config.ENTITY_DENSITY_BENCHMARK, 1.0)

    # — term_consistency: key terms shared across ≥2 pages
    all_texts: list[str] = []
    brand_mentions: list[int] = []
    for content in contents:
        page_text = " ".join(
            p.get("passageText") or p.get("passage_text", "")
            for p in content.get("passages", [])
        ).lower()
        all_texts.append(page_text)
        brand_mentions.append(page_text.count(brand_lower))

    word_counts: dict[str, int] = {}
    for text in all_texts:
        words = re.findall(r"\b[a-z]{4,}\b", text)
        for w in set(words):
            word_counts[w] = word_counts.get(w, 0) + 1

    consistent_terms = sum(1 for v in word_counts.values() if v >= 2)
    term_score = min(consistent_terms / 20, 1.0)

    # — entity_home_strength: Organization schema + sameAs richness
    if org_schemas:
        if len(same_as_links) >= 3:
            entity_home = 1.0
        elif same_as_links:
            entity_home = 0.6
        else:
            entity_home = 0.4
    else:
        entity_home = 0.2

    score = round(
        kg_presence     * 0.30
        + corroboration * 0.25
        + entity_density_score * 0.20
        + term_score    * 0.15
        + entity_home   * 0.10,
        3,
    )
    return score


def _is_schema_type(schema: dict | list, target_type: str) -> bool:
    if isinstance(schema, list):
        return any(_is_schema_type(s, target_type) for s in schema)
    schema_type = schema.get("@type", "")
    if isinstance(schema_type, list):
        return target_type in schema_type
    return schema_type == target_type


# ── Extractability score (ex chunkability) ─────────────────────────────────

def score_extractability(
    contents: list[dict[str, Any]],
    schema_data: dict[str, Any] | None = None,
    robots_blocked: list[str] | None = None,
) -> float:
    """
    Score how easily AI models can extract and cite content.

    Sub-criteria and weights:
        passage_length     20%  — 134–167 word passages score highest
        answer_capsule     20%  — short definitive blocks after headings
        schema_markup      20%  — Article + FAQ + Org schema present
        heading_structure  15%  — headings present and question-formatted
        ai_crawler_access  15%  — no AI bots blocked in robots.txt
        self_ref_pollution 10%  — absence of self-referential filler phrases
    """
    if not contents:
        return 0.5

    schema_data = schema_data or {}
    robots_blocked = robots_blocked or []

    all_passages = [p for c in contents for p in c.get("passages", [])]
    if not all_passages:
        return 0.5

    # — passage_length
    wc_scores: list[float] = []
    for p in all_passages:
        wc = p.get("wordCount") or p.get("word_count", 0)
        if 134 <= wc <= 167:
            wc_scores.append(1.0)
        elif 80 <= wc < 134 or 167 < wc <= 250:
            wc_scores.append(0.7)
        else:
            wc_scores.append(0.4)
    passage_length_score = sum(wc_scores) / len(wc_scores)

    # — answer_capsule: proportion of passages that are answer-first AND short (40–60 words)
    capsule_count = sum(
        1 for p in all_passages
        if (p.get("isAnswerFirst") or p.get("is_answer_first", False))
        and config.ANSWER_CAPSULE_MIN <= (p.get("wordCount") or p.get("word_count", 0)) <= config.ANSWER_CAPSULE_MAX
    )
    answer_capsule_score = min(capsule_count / max(len(all_passages) * 0.2, 1), 1.0)

    # — schema_markup
    has_article = schema_data.get("has_article_schema", False)
    has_faq = schema_data.get("has_faq_schema", False)
    has_org = schema_data.get("has_org_schema", False)
    schema_score = (0.4 * has_article + 0.35 * has_faq + 0.25 * has_org)

    # — heading_structure
    passages_with_heading = sum(1 for p in all_passages if p.get("heading"))
    heading_ratio = passages_with_heading / len(all_passages)
    question_headings = sum(
        1 for p in all_passages
        if (p.get("isQuestionHeading") or p.get("is_question_heading", False))
    )
    question_ratio = question_headings / len(all_passages)
    heading_score = (heading_ratio * 0.5) + (question_ratio * 0.5)

    # — ai_crawler_access: penalize for each blocked bot
    access_score = max(0.0, 1.0 - len(robots_blocked) * 0.2)

    # — self_ref_pollution: penalize vague self-referential phrases
    _SELF_REF = re.compile(
        r'\b(as (we|I) (mentioned|said|discussed)|come (detto|menzionato)|come sopra)\b',
        re.IGNORECASE,
    )
    polluted = sum(
        1 for p in all_passages
        if _SELF_REF.search(p.get("passageText") or p.get("passage_text", ""))
    )
    pollution_score = max(0.0, 1.0 - polluted / len(all_passages))

    score = round(
        passage_length_score  * 0.20
        + answer_capsule_score * 0.20
        + schema_score         * 0.20
        + heading_score        * 0.15
        + access_score         * 0.15
        + pollution_score      * 0.10,
        3,
    )
    return score


# ── Source Authority score (ex cross-platform) ─────────────────────────────

def score_source_authority(
    platform_results: dict[str, list[str]],
    ai_platform_target: str = "all",
) -> float:
    """
    Score based on presence across platforms, weighted by AI target.

    ai_platform_target: 'all' | 'google_ai' | 'chatgpt' | 'perplexity'
    """
    if not platform_results:
        return 0.0

    # Platform weights per target audience
    _WEIGHTS: dict[str, dict[str, float]] = {
        "all": {
            "website": 0.25, "linkedin": 0.15, "medium": 0.10,
            "reddit": 0.10, "news": 0.20, "youtube": 0.10,
            "substack": 0.05, "other": 0.05,
        },
        "google_ai": {
            "website": 0.35, "news": 0.25, "reddit": 0.15,
            "linkedin": 0.10, "youtube": 0.10, "other": 0.05,
        },
        "chatgpt": {
            "website": 0.30, "medium": 0.20, "reddit": 0.15,
            "linkedin": 0.15, "news": 0.10, "other": 0.10,
        },
        "perplexity": {
            "website": 0.25, "reddit": 0.20, "news": 0.20,
            "linkedin": 0.15, "medium": 0.10, "other": 0.10,
        },
    }
    weights = _WEIGHTS.get(ai_platform_target, _WEIGHTS["all"])

    score = 0.0
    for platform, urls in platform_results.items():
        if urls:
            score += weights.get(platform, 0.0)

    return round(min(score, 1.0), 3)


# ── Freshness multiplier ───────────────────────────────────────────────────

def compute_freshness_multiplier(contents: list[dict[str, Any]]) -> float:
    """
    Compute a project-level freshness multiplier based on content modification dates.

    Uses schema dateModified if available, else lastFetchedAt / last_fetched_at.
    Returns a multiplier in [0.70, 1.15] applied to the composite score.
    """
    multipliers: list[float] = []
    now = datetime.utcnow()

    for content in contents:
        raw_date = (
            content.get("dateModifiedSchema")
            or content.get("date_modified_schema")
            or content.get("lastFetchedAt")
            or content.get("last_fetched_at")
        )
        if not raw_date:
            multipliers.append(config.FRESHNESS_NEUTRAL)
            continue

        if isinstance(raw_date, str):
            try:
                raw_date = datetime.fromisoformat(raw_date.replace("Z", "+00:00"))
            except ValueError:
                multipliers.append(config.FRESHNESS_NEUTRAL)
                continue

        days_old = (now - raw_date.replace(tzinfo=None)).days

        if days_old < 30:
            multipliers.append(config.FRESHNESS_BOOST_30D)
        elif days_old < 60:
            multipliers.append(config.FRESHNESS_NEUTRAL)
        elif days_old < 120:
            multipliers.append(config.FRESHNESS_DECAY_120D)
        else:
            multipliers.append(config.FRESHNESS_PENALTY)

    return round(sum(multipliers) / len(multipliers), 3) if multipliers else config.FRESHNESS_NEUTRAL


# ── Insight generation ─────────────────────────────────────────────────────

async def generate_insights(
    brand_name: str,
    scores: dict[str, float],
    language: str,
) -> list[str]:
    """Generate 3–4 insight bullets using Claude or Gemini."""
    _LANG_NAMES = {"it": "Italian", "en": "English", "es": "Spanish", "fr": "French", "de": "German", "pt": "Portuguese"}
    lang_instruction = f"in {_LANG_NAMES.get(language[:2].lower(), 'English')}"

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
                model="claude-sonnet-4-6",
                max_tokens=400,
                messages=[{"role": "user", "content": prompt}],
            )
            text = msg.content[0].text.strip()
            bullets = [ln.strip().lstrip("•").strip() for ln in text.splitlines() if ln.strip().startswith("•")]
            if bullets:
                return bullets[:4]
        except Exception:
            pass

    if _gemini_client:
        try:
            response = await _gemini_client.aio.models.generate_content(
                model="gemini-2.5-flash", contents=prompt
            )
            text = response.text.strip()
            bullets = [ln.strip().lstrip("•").strip() for ln in text.splitlines() if ln.strip().startswith("•")]
            if bullets:
                return bullets[:4]
        except Exception:
            pass

    return [
        f"Your AI Readiness Score is {scores.get('ai_readiness_score', 0):.0%}.",
        "Improve content extractability by adding structured headings and answer-first passages.",
        "Expand your presence across AI-indexed platforms.",
    ]


# ── Composite AI Readiness Score ───────────────────────────────────────────

SCORE_WEIGHTS = {
    "fanout_coverage_score":  0.30,
    "citation_power_score":   0.25,
    "entity_authority_score": 0.20,
    "extractability_score":   0.15,
    "source_authority_score": 0.10,
}


def compute_ai_readiness(scores: dict[str, float], freshness_multiplier: float = 1.0) -> float:
    """
    Weighted composite of the 5 sub-scores × freshness multiplier → AI Readiness Score.
    Result is clamped to [0.0, 1.0].
    """
    total = sum(scores.get(k, 0.0) * w for k, w in SCORE_WEIGHTS.items())
    return round(min(total * freshness_multiplier, 1.0), 3)
