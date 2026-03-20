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

    # Internal
    ANALYZER_API_KEY: str = os.getenv("ANALYZER_API_KEY", "dev-internal-key")

    # Tuning
    MAX_PAGES_TO_FETCH: int = int(os.getenv("MAX_PAGES_TO_FETCH", "8"))
    COVERAGE_THRESHOLD: float = float(os.getenv("COVERAGE_THRESHOLD", "0.60"))
    FANOUT_PER_QUERY: int = int(os.getenv("FANOUT_PER_QUERY", "10"))
    WORKER_POLL_INTERVAL: int = int(os.getenv("WORKER_POLL_INTERVAL", "5"))


config = Config()
