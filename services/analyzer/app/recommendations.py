from __future__ import annotations

"""
Recommendation generation for the full analysis pipeline.

Generates 5–10 prioritized, actionable recommendations based on project
scores and content state. Saves them to the recommendations table.
"""

import json
import logging
import re
from typing import Any

log = logging.getLogger(__name__)

try:
    import anthropic
    from .config import config as _cfg
    _claude = anthropic.AsyncAnthropic(api_key=_cfg.ANTHROPIC_API_KEY) if _cfg.ANTHROPIC_API_KEY else None
except ImportError:
    _claude = None

try:
    from google import genai as _google_genai
    from .config import config as _cfg2
    _gemini = _google_genai.Client(api_key=_cfg2.GOOGLE_AI_API_KEY) if _cfg2.GOOGLE_AI_API_KEY else None
except ImportError:
    _gemini = None

_REC_SCHEMA = """{
  "recommendations": [
    {
      "type": "quick_win|content_gap|platform_opportunity",
      "priority": "high|medium|low",
      "effort": "quick|moderate|significant",
      "title": "short title",
      "description": "2–3 sentences explaining why this matters",
      "suggestedAction": "specific action to take",
      "targetScore": "fanout_coverage_score|citation_power_score|extractability_score|entity_authority_score|source_authority_score"
    }
  ]
}"""


async def generate_recommendations(
    brand_name: str,
    scores: dict[str, float],
    language: str,
) -> list[dict[str, Any]]:
    """
    Generate 5–10 prioritized recommendations based on scores.
    Returns list of recommendation dicts ready to be saved to DB.
    """
    lang_instruction = "in Italian" if language == "it" else "in English"

    score_lines = "\n".join(
        f"- {k.replace('_', ' ').title()}: {v:.0%}" for k, v in scores.items()
    )

    prompt = (
        f"You are an AI visibility consultant analyzing brand '{brand_name}'.\n\n"
        f"Current scores:\n{score_lines}\n\n"
        f"Generate 5–8 specific, actionable recommendations {lang_instruction} to improve AI visibility.\n"
        f"Focus on the lowest-scoring dimensions first.\n"
        f"Types:\n"
        f"  - quick_win: fast to implement, high impact\n"
        f"  - content_gap: missing content or topics\n"
        f"  - platform_opportunity: cross-platform presence\n\n"
        f"Return ONLY valid JSON matching this schema (no markdown, no extra text):\n"
        f"{_REC_SCHEMA}"
    )

    raw = None
    if _claude:
        try:
            msg = await _claude.messages.create(
                model="claude-sonnet-4-5",
                max_tokens=2000,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = msg.content[0].text.strip()
        except Exception as e:
            log.warning(f"Claude recommendations failed: {e}")

    if not raw and _gemini:
        try:
            response = await _gemini.aio.models.generate_content(
                model="gemini-2.5-flash", contents=prompt
            )
            raw = response.text.strip()
        except Exception as e:
            log.warning(f"Gemini recommendations failed: {e}")

    if not raw:
        return _fallback_recommendations(scores, language)

    # Strip markdown code fences if present
    raw = re.sub(r"^```(?:json)?\s*", "", raw).rstrip("` \n")

    try:
        data = json.loads(raw)
        recs = data.get("recommendations", [])
        return [_normalize(r) for r in recs if isinstance(r, dict)][:8]
    except (json.JSONDecodeError, KeyError) as e:
        log.warning(f"Failed to parse recommendations JSON: {e}")
        return _fallback_recommendations(scores, language)


def _normalize(r: dict) -> dict:
    """Ensure all required fields are present with valid values."""
    valid_types = {"quick_win", "content_gap", "platform_opportunity"}
    valid_priorities = {"high", "medium", "low"}
    valid_efforts = {"quick", "moderate", "significant"}
    valid_scores = {
        "fanout_coverage_score", "citation_power_score", "extractability_score",
        "entity_authority_score", "source_authority_score",
    }
    return {
        "type": r.get("type") if r.get("type") in valid_types else "quick_win",
        "priority": r.get("priority") if r.get("priority") in valid_priorities else "medium",
        "effort": r.get("effort") if r.get("effort") in valid_efforts else "moderate",
        "title": str(r.get("title", ""))[:200],
        "description": str(r.get("description", "")),
        "suggestedAction": str(r.get("suggestedAction", "")),
        "targetScore": r.get("targetScore") if r.get("targetScore") in valid_scores else None,
    }


def _fallback_recommendations(scores: dict[str, float], language: str) -> list[dict]:
    """Return generic recommendations when LLM generation fails."""
    it = language == "it"
    recs = []
    if scores.get("fanout_coverage_score", 1.0) < 0.6:
        recs.append({
            "type": "content_gap",
            "priority": "high",
            "effort": "significant",
            "title": "Espandi la copertura tematica" if it else "Expand topical coverage",
            "description": (
                "La tua copertura delle query correlate è bassa."
                if it else
                "Your coverage of related queries is low."
            ),
            "suggestedAction": (
                "Crea contenuti che rispondano alle domande correlate del tuo pubblico."
                if it else
                "Create content that answers related questions your audience is asking."
            ),
            "targetScore": "fanout_coverage_score",
        })
    if scores.get("source_authority_score", 1.0) < 0.5:
        recs.append({
            "type": "platform_opportunity",
            "priority": "high",
            "effort": "moderate",
            "title": "Aumenta la presenza cross-platform" if it else "Increase cross-platform presence",
            "description": (
                "Sei presente su poche piattaforme esterne."
                if it else
                "You have limited presence on external platforms."
            ),
            "suggestedAction": (
                "Pubblica su LinkedIn, Reddit o Medium per aumentare l'autorità."
                if it else
                "Publish on LinkedIn, Reddit, or Medium to increase authority."
            ),
            "targetScore": "source_authority_score",
        })
    return recs or [{
        "type": "quick_win",
        "priority": "medium",
        "effort": "quick",
        "title": "Ottimizza i passaggi esistenti" if it else "Optimize existing passages",
        "description": (
            "Migliora la qualità dei passaggi esistenti per aumentare il punteggio."
            if it else
            "Improve the quality of existing passages to increase your score."
        ),
        "suggestedAction": (
            "Riscrivi i passaggi più deboli per renderli più autonomi e informativi."
            if it else
            "Rewrite your weakest passages to make them more self-contained and informative."
        ),
        "targetScore": "citation_power_score",
    }]


def save_recommendations(
    conn,
    project_id: str,
    snapshot_id: str,
    recommendations: list[dict],
) -> None:
    """
    Delete old recommendations for this project and insert new ones.
    """
    with conn.cursor() as cur:
        # Clear previous recommendations (replaced by new snapshot's)
        cur.execute('DELETE FROM recommendations WHERE "projectId" = %s', (project_id,))
        for rec in recommendations:
            cur.execute(
                """
                INSERT INTO recommendations (
                    id, "projectId", "snapshotId",
                    type, priority, effort,
                    title, description, "suggestedAction",
                    "targetScore", status, "createdAt", "updatedAt"
                )
                VALUES (
                    gen_random_uuid(), %s, %s,
                    %s, %s, %s,
                    %s, %s, %s,
                    %s, 'pending', NOW(), NOW()
                )
                """,
                (
                    project_id, snapshot_id,
                    rec["type"], rec["priority"], rec["effort"],
                    rec["title"], rec["description"], rec.get("suggestedAction"),
                    rec.get("targetScore"),
                ),
            )
