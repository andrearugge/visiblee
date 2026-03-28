"""
Environment configuration for the Visiblee Analyzer microservice.
"""

import os
from dotenv import load_dotenv

load_dotenv()


def _require(key: str) -> str:
    value = os.getenv(key)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {key}")
    return value


class Config:
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")

    # LLM providers
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    GOOGLE_AI_API_KEY: str = os.getenv("GOOGLE_AI_API_KEY", "")

    # Embeddings
    VOYAGE_API_KEY: str = os.getenv("VOYAGE_API_KEY", "")

    # Search
    BRAVE_SEARCH_API_KEY: str = os.getenv("BRAVE_SEARCH_API_KEY", "")

    # Email
    MAILERSEND_API_KEY: str = os.getenv("MAILERSEND_API_KEY", "")
    EMAIL_FROM: str = os.getenv("EMAIL_FROM", "noreply@visiblee.ai")

    # App URL (used for links in emails)
    APP_URL: str = os.getenv("APP_URL", "http://localhost:3000")

    # Google OAuth (used for GSC token refresh)
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")

    # Internal
    ANALYZER_API_KEY: str = os.getenv("ANALYZER_API_KEY", "dev-internal-key")

    # Tuning
    MAX_PAGES_TO_FETCH: int = int(os.getenv("MAX_PAGES_TO_FETCH", "8"))
    FANOUT_PER_QUERY: int = int(os.getenv("FANOUT_PER_QUERY", "10"))
    WORKER_POLL_INTERVAL: int = int(os.getenv("WORKER_POLL_INTERVAL", "5"))

    # Coverage thresholds — 4-tier system (v2)
    # COVERAGE_THRESHOLD is kept for backward compat (preview pipeline) but deprecated.
    COVERAGE_THRESHOLD: float = float(os.getenv("COVERAGE_THRESHOLD", "0.60"))  # deprecated
    COVERAGE_EXCELLENT: float = float(os.getenv("COVERAGE_EXCELLENT", "0.88"))
    COVERAGE_GOOD: float = float(os.getenv("COVERAGE_GOOD", "0.75"))
    COVERAGE_WEAK: float = float(os.getenv("COVERAGE_WEAK", "0.60"))

    # Freshness multipliers
    FRESHNESS_BOOST_30D: float = float(os.getenv("FRESHNESS_BOOST_30D", "1.15"))
    FRESHNESS_NEUTRAL: float = float(os.getenv("FRESHNESS_NEUTRAL", "1.00"))
    FRESHNESS_DECAY_120D: float = float(os.getenv("FRESHNESS_DECAY_120D", "0.85"))
    FRESHNESS_PENALTY: float = float(os.getenv("FRESHNESS_PENALTY", "0.70"))

    # Entity density benchmark (empirical — average authoritative content)
    ENTITY_DENSITY_BENCHMARK: float = float(os.getenv("ENTITY_DENSITY_BENCHMARK", "0.206"))

    # Answer capsule target size (words)
    ANSWER_CAPSULE_MIN: int = int(os.getenv("ANSWER_CAPSULE_MIN", "40"))
    ANSWER_CAPSULE_MAX: int = int(os.getenv("ANSWER_CAPSULE_MAX", "60"))

    # Gemini Grounding (citation verification) — same key as GOOGLE_AI_API_KEY
    GOOGLE_AI_API_KEY_GROUNDING: str = os.getenv("GOOGLE_AI_API_KEY", "")

    # GSC integration — encryption key for OAuth tokens (64 hex chars)
    GSC_TOKEN_ENCRYPTION_KEY: str = os.getenv("GSC_TOKEN_ENCRYPTION_KEY", "")

    # Free tier limits
    MAX_QUERIES_FREE: int = int(os.getenv("MAX_QUERIES_FREE", "5"))
    MAX_CONTENTS_FREE: int = int(os.getenv("MAX_CONTENTS_FREE", "20"))


config = Config()
