from __future__ import annotations

"""
Visiblee — Python Analyzer Microservice
Handles AI analysis, scoring, embedding, and content processing.
"""

import logging
import warnings
from typing import Optional

# Suppress known harmless warnings on macOS with Python 3.9 / LibreSSL
warnings.filterwarnings("ignore", category=DeprecationWarning, module="urllib3")
warnings.filterwarnings("ignore", message=".*NotOpenSSLWarning.*")
warnings.filterwarnings("ignore", message=".*end of life.*", category=FutureWarning)

import psycopg2

from fastapi import FastAPI, HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import config
from .discovery import discover_content
from .fetcher import fetch_url
from .models import (
    DiscoverRequest,
    DiscoverResponse,
    DiscoveredContent,
    FetchContentRequest,
    FetchContentResponse,
    PassageResult,
    PreviewAnalyzeRequest,
    PreviewAnalyzeResponse,
)
from .full_pipeline import run_preview_pipeline
from .segmenter import segment_html

log = logging.getLogger(__name__)
security = HTTPBearer(auto_error=False)


def verify_api_key(credentials: Optional[HTTPAuthorizationCredentials]) -> None:
    """Validate internal API key."""
    if not config.ANALYZER_API_KEY:
        return  # no key configured — open in dev
    if credentials is None or credentials.credentials != config.ANALYZER_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


app = FastAPI(
    title="Visiblee Analyzer",
    description="AI analysis, scoring, and embedding microservice for Visiblee",
    version="0.2.0",
)


@app.get("/api/v1/health")
def health() -> dict:
    """Health check endpoint — verifies DB connectivity."""
    try:
        conn = psycopg2.connect(config.DATABASE_URL)
        conn.close()
        db_status = "ok"
    except Exception as e:
        log.error(f"Health check DB error: {e}")
        db_status = str(e)

    return {"status": "ok", "db": db_status}


@app.post("/api/v1/preview-analyze", response_model=PreviewAnalyzeResponse)
async def preview_analyze(
    request: PreviewAnalyzeRequest,
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security),
) -> PreviewAnalyzeResponse:
    """
    Run the full preview analysis pipeline for a given website.
    Used for direct HTTP testing. In production the worker calls
    run_preview_pipeline() directly as a Python function.

    Expected body (snake_case):
      { "website_url": "...", "brand_name": "...", "query_targets": [...], "language": "en" }
    """
    verify_api_key(credentials)

    try:
        result = await run_preview_pipeline(
            website_url=request.website_url,
            brand_name=request.brand_name,
            query_targets=request.query_targets,
            language=request.language,
        )
    except Exception as e:
        log.error(f"Pipeline error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    return PreviewAnalyzeResponse(
        scores=result["scores"],
        insights=result["insights"],
        contents_found=result["contents_found"],
        analysis_data=result["analysis_data"],
    )


@app.post("/api/v1/discover", response_model=DiscoverResponse)
async def discover(
    request: DiscoverRequest,
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security),
) -> DiscoverResponse:
    """
    Run the content discovery pipeline for a website.
    Returns classified URLs (own / mention) with platform detection.
    Used for direct HTTP testing; in production the worker processes discovery jobs.
    """
    verify_api_key(credentials)

    try:
        results = await discover_content(
            website_url=request.website_url,
            brand_name=request.brand_name,
            language=request.language,
        )
    except Exception as e:
        log.error(f"Discovery error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    items = [
        DiscoveredContent(
            url=r["url"],
            title=r["title"],
            snippet=r["snippet"],
            platform=r["platform"],
            content_type=r["contentType"],
            confidence=r["confidence"],
        )
        for r in results
    ]
    return DiscoverResponse(results=items, total=len(items))


@app.post("/api/v1/fetch-content", response_model=FetchContentResponse)
async def fetch_content_endpoint(
    request: FetchContentRequest,
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security),
) -> FetchContentResponse:
    """
    Fetch a single URL and segment into passages.
    Used for direct HTTP testing; in production the worker processes fetch_content jobs.
    """
    verify_api_key(credentials)

    fetched = await fetch_url(request.url)
    if not fetched:
        raise HTTPException(status_code=422, detail="Could not fetch or parse the URL")

    passages = segment_html(fetched["html"])

    return FetchContentResponse(
        url=request.url,
        title=fetched["title"],
        word_count=fetched["word_count"],
        passages=[
            PassageResult(
                passage_index=p["passageIndex"],
                passage_text=p["passageText"],
                word_count=p["wordCount"],
                heading=p["heading"],
            )
            for p in passages
        ],
    )
