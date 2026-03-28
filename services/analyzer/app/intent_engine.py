from __future__ import annotations

"""
Intent Engine — classifies GSC queries and generates intent profiles.

Fully heuristic (no LLM), per AD-02.
"""

import re
from collections import Counter
from typing import Literal

from .embeddings import cosine_similarity, embed_texts

IntentType = Literal[
    "informational",
    "comparative",
    "decisional",
    "navigational",
    "conversational_ai",
]

# ---------------------------------------------------------------------------
# Regex patterns for IT + EN
# ---------------------------------------------------------------------------

INTENT_PATTERNS: dict[str, dict[str, list[str]]] = {
    "informational": {
        "it": [
            r"\bcome\s+(funziona|fare|si\s+fa)\b",
            r"\bcos[a']?\s+(è|sono)\b",
            r"\bperch[eé]\b",
            r"\bquando\b",
            r"\bguida\b",
            r"\btutorial\b",
            r"\bspiegazione\b",
            r"\bdifferenza\s+tra\b",
        ],
        "en": [
            r"\bhow\s+to\b",
            r"\bwhat\s+is\b",
            r"\bwhy\b",
            r"\bguide\b",
            r"\btutorial\b",
            r"\bexplain\b",
            r"\bdifference\s+between\b",
        ],
    },
    "comparative": {
        "it": [
            r"\bvs\.?\b",
            r"\bversus\b",
            r"\bmiglior[ei]?\b",
            r"\balternativ[ae]\s+a\b",
            r"\bconfronto\b",
            r"\bcomparazione\b",
            r"\bo\b.+\bo\b",
            r"\btop\s+\d+\b",
        ],
        "en": [
            r"\bvs\.?\b",
            r"\bversus\b",
            r"\bbest\b",
            r"\balternative\s+to\b",
            r"\bcompare\b",
            r"\bcomparison\b",
            r"\btop\s+\d+\b",
            r"\bor\b.+\bor\b",
        ],
    },
    "decisional": {
        "it": [
            r"\bquale\b.+\bscegliere\b",
            r"\bprezzo\b",
            r"\bcosto\b",
            r"\bcomprare\b",
            r"\bacquistare\b",
            r"\babbonam\w+\b",
            r"\bprova\s+gratuita\b",
            r"\bdemo\b",
        ],
        "en": [
            r"\bwhich\b.+\bchoose\b",
            r"\bprice\b",
            r"\bcost\b",
            r"\bbuy\b",
            r"\bpurchase\b",
            r"\bsubscri\w+\b",
            r"\bfree\s+trial\b",
            r"\bdemo\b",
            r"\bnear\s+me\b",
        ],
    },
    "navigational": {
        "both": [
            r"\blogin\b",
            r"\bsign\s*(in|up)\b",
            r"\baccedi\b",
            r"\bregistra\w*\b",
            r"\bsito\s+ufficiale\b",
            r"\bofficial\s+site\b",
            r"\bdownload\b",
        ],
    },
}

# Common stopwords for IT + EN (used when extracting top patterns)
_STOPWORDS = {
    "it": {
        "il", "la", "i", "le", "lo", "un", "una", "del", "della", "dei", "delle",
        "di", "da", "in", "a", "e", "è", "per", "con", "su", "ma", "se", "come",
        "che", "chi", "cosa", "quando", "dove", "perché", "non", "ho", "hai",
        "ha", "ci", "mi", "ti", "si", "al", "allo", "alla", "agli", "alle",
    },
    "en": {
        "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
        "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
        "have", "has", "do", "does", "can", "will", "would", "should", "could",
        "i", "my", "me", "you", "your", "it", "its", "this", "that", "what",
        "how", "why", "when", "where", "which", "who",
    },
}


# ---------------------------------------------------------------------------
# C2 — classify_intent (heuristic, no LLM)
# ---------------------------------------------------------------------------

def classify_intent(
    query: str,
    target_language: str,
    brand_name: str,
) -> tuple[IntentType, float]:
    """
    Classify the intent of a query.
    Returns (intent_type, confidence 0-1).
    """
    query_lower = query.lower().strip()
    word_count = len(query_lower.split())

    # 1. Conversational / AI-mode (8+ words always; 6+ if starts with conversational patterns)
    if word_count >= 8:
        return ("conversational_ai", 0.85)
    if word_count >= 6 and any(
        query_lower.startswith(p)
        for p in [
            "come posso", "qual è il modo", "mi puoi", "vorrei sapere",
            "how can i", "what's the best way", "i want to", "can you",
        ]
    ):
        return ("conversational_ai", 0.90)

    # 2. Navigational (brand in query + nav pattern OR short query with brand)
    if brand_name and brand_name.lower() in query_lower:
        nav_patterns = INTENT_PATTERNS["navigational"]["both"]
        if any(re.search(p, query_lower) for p in nav_patterns):
            return ("navigational", 0.95)
        if word_count <= 3:
            return ("navigational", 0.80)

    # 3. Navigational patterns regardless of brand
    nav_patterns = INTENT_PATTERNS["navigational"]["both"]
    if any(re.search(p, query_lower) for p in nav_patterns):
        return ("navigational", 0.80)

    # 4. Pattern matching for informational / comparative / decisional
    scores: dict[str, float] = {}
    lang_key = target_language if target_language in ("it", "en") else "en"

    for intent, patterns_by_lang in INTENT_PATTERNS.items():
        if intent == "navigational":
            continue
        lang_patterns = patterns_by_lang.get(lang_key, []) + patterns_by_lang.get("both", [])
        match_count = sum(1 for p in lang_patterns if re.search(p, query_lower))
        if match_count > 0:
            scores[intent] = min(0.60 + (match_count * 0.15), 0.95)

    if scores:
        best_intent = max(scores, key=lambda k: scores[k])
        return (best_intent, scores[best_intent])  # type: ignore[return-value]

    # 5. Default: informational
    return ("informational", 0.50)


# ---------------------------------------------------------------------------
# C3 — generate_query_suggestions
# ---------------------------------------------------------------------------

async def generate_query_suggestions(
    project_id: str,
    gsc_queries: list[dict],
    existing_target_queries: list[str],
    target_language: str,
) -> list[dict]:
    """
    Identify GSC queries that should be suggested as new target queries.

    Criteria:
    - >= 50 impressions in period
    - not navigational
    - not already covered by existing targets (cosine similarity < 0.88)
    """
    candidates = [
        q for q in gsc_queries
        if q.get("impressions", 0) >= 50
        and q.get("intentType") != "navigational"
        and q.get("intentType") is not None
    ]
    candidates.sort(key=lambda q: q.get("impressions", 0), reverse=True)
    candidates = candidates[:50]

    if not candidates:
        return []

    # Embed existing targets for similarity filtering
    target_embeddings: list[list[float]] = []
    if existing_target_queries:
        target_embeddings = await embed_texts(existing_target_queries, input_type="query")

    # Embed all candidates in one batch
    candidate_texts = [c["query"] for c in candidates]
    candidate_embeddings = await embed_texts(candidate_texts, input_type="query")

    suggestions: list[dict] = []

    for i, candidate in enumerate(candidates):
        cand_emb = candidate_embeddings[i]
        max_similarity = 0.0
        matched_query_text: str | None = None

        for j, te in enumerate(target_embeddings):
            sim = cosine_similarity(cand_emb, te)
            if sim > max_similarity:
                max_similarity = sim
                matched_query_text = existing_target_queries[j]

        # Skip if too similar to an existing target
        if max_similarity > 0.88:
            continue

        # Determine suggestion reason
        if candidate.get("isLongQuery"):
            reason = "query_ai_mode"
        elif candidate.get("intentType") == "comparative":
            reason = "high_commercial_intent"
        elif candidate.get("impressions", 0) > 200:
            reason = "high_visibility"
        else:
            reason = "coverage_gap"

        suggestions.append({
            "query": candidate["query"],
            "reason": reason,
            "intentType": candidate["intentType"],
            "impressions": candidate["impressions"],
            "clicks": candidate.get("clicks", 0),
            "avgPosition": candidate.get("position", 0.0),
            "matchedTargetQueryId": matched_query_text if max_similarity > 0.60 else None,
            "similarityScore": max_similarity if max_similarity > 0.60 else None,
        })

    return suggestions[:20]


# ---------------------------------------------------------------------------
# C4 — generate_intent_profiles + _build_context_prompt
# ---------------------------------------------------------------------------

def _extract_top_patterns(queries: list[dict], lang_key: str, top_n: int = 5) -> list[str]:
    """Extract the most frequent non-stopword tokens across query texts."""
    stopwords = _STOPWORDS.get(lang_key, _STOPWORDS["en"])
    counter: Counter[str] = Counter()
    for q in queries:
        words = q["query"].lower().split()
        for w in words:
            w_clean = re.sub(r"[^\w]", "", w)
            if w_clean and w_clean not in stopwords and len(w_clean) > 2:
                counter[w_clean] += 1
    return [word for word, _ in counter.most_common(top_n)]


def _build_context_prompt(
    intent_type: str,
    sample_queries: list[str],
    dominant_device: str | None,
    target_language: str,
    brand_name: str,
) -> str:
    """
    Build the system prompt addendum for simulating a user with this profile
    during the citation check. NOT used for scoring (AD-02 respected).
    """
    device_context = ""
    if dominant_device == "MOBILE":
        device_context = "The user is searching from a mobile device and expects concise, direct answers."
    elif dominant_device == "DESKTOP":
        device_context = "The user is searching from desktop, likely in a work context, and expects detailed information."

    sample_str = ", ".join(f'"{q}"' for q in sample_queries[:3])

    intent_contexts = {
        "informational": (
            f"The user is researching and learning about this topic. "
            f"They have previously searched for: {sample_str}. "
            f"They want comprehensive, educational information."
        ),
        "comparative": (
            f"The user is actively comparing alternatives. "
            f"They have previously searched for: {sample_str}. "
            f"They want to understand trade-offs between options."
        ),
        "decisional": (
            f"The user is close to making a decision or purchase. "
            f"They have previously searched for: {sample_str}. "
            f"They want definitive recommendations and actionable information."
        ),
        "conversational_ai": (
            f"The user is using conversational, natural language queries typical of AI Mode. "
            f"They have previously asked: {sample_str}. "
            f"They expect a synthesized, comprehensive answer."
        ),
    }

    context = intent_contexts.get(intent_type, f"The user has searched for: {sample_str}.")
    parts = [p for p in [context, device_context] if p]
    return " ".join(parts)


def generate_intent_profiles(
    project_id: str,
    gsc_queries: list[dict],
    brand_name: str,
    target_language: str,
) -> list[dict]:
    """
    Generate 2-4 Intent Profiles from GSC query clusters.

    Each profile represents a user type derived from real search patterns.
    """
    lang_key = target_language if target_language in ("it", "en") else "en"

    # Group by dominant intent (skip navigational)
    intent_groups: dict[str, list[dict]] = {}
    for q in gsc_queries:
        intent = q.get("intentType")
        if intent and intent != "navigational":
            intent_groups.setdefault(intent, []).append(q)

    profiles: list[dict] = []

    for intent_type, queries in intent_groups.items():
        if len(queries) < 10:
            continue

        total_impressions = sum(q.get("impressions", 0) for q in queries)
        avg_query_length = sum(len(q["query"].split()) for q in queries) / len(queries)

        # Dominant device (by impressions)
        device_counts: dict[str, int] = {}
        for q in queries:
            if q.get("device"):
                device_counts[q["device"]] = device_counts.get(q["device"], 0) + q.get("impressions", 0)
        dominant_device: str | None = None
        if device_counts:
            top_device = max(device_counts, key=lambda k: device_counts[k])
            if total_impressions > 0 and device_counts[top_device] / total_impressions > 0.60:
                dominant_device = top_device

        # Dominant country (by impressions)
        country_counts: dict[str, int] = {}
        for q in queries:
            if q.get("country"):
                country_counts[q["country"]] = country_counts.get(q["country"], 0) + q.get("impressions", 0)
        dominant_country: str | None = max(country_counts, key=lambda k: country_counts[k]) if country_counts else None

        # Top patterns
        top_patterns = _extract_top_patterns(queries, lang_key, top_n=5)

        # Sample queries (top 5 by impressions)
        sorted_queries = sorted(queries, key=lambda q: q.get("impressions", 0), reverse=True)
        sample_queries = [q["query"] for q in sorted_queries[:5]]

        # Profile name + description
        profile_meta = {
            "informational": ("Researcher", "User in research and learning phase"),
            "comparative": ("Evaluator", "User comparing options and alternatives"),
            "decisional": ("Decision Maker", "User ready to choose or purchase"),
            "conversational_ai": ("AI Explorer", "User using conversational queries typical of AI Mode"),
        }
        name, description = profile_meta.get(intent_type, ("Generic", "Generic profile"))

        context_prompt = _build_context_prompt(
            intent_type=intent_type,
            sample_queries=sample_queries,
            dominant_device=dominant_device,
            target_language=target_language,
            brand_name=brand_name,
        )

        profiles.append({
            "name": name,
            "slug": name.lower().replace(" ", "-"),
            "description": description,
            "dominantIntent": intent_type,
            "dominantDevice": dominant_device,
            "dominantCountry": dominant_country,
            "avgQueryLength": round(avg_query_length, 2),
            "queryCount": len(queries),
            "totalImpressions": total_impressions,
            "topPatterns": top_patterns,
            "sampleQueries": sample_queries,
            "contextPrompt": context_prompt,
        })

    # Sort by impressions descending, max 4 profiles
    profiles.sort(key=lambda p: p["totalImpressions"], reverse=True)
    return profiles[:4]
