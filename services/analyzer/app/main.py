from __future__ import annotations

"""
Visiblee — Python Analyzer Microservice
Handles AI analysis, scoring, embedding, and content processing.
"""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import config
from .models import PreviewAnalyzeRequest, PreviewAnalyzeResponse
from .pipeline import run_preview_pipeline

log = logging.getLogger(__name__)
security = HTTPBearer(auto_error=False)


def verify_api_key(credentials: HTTPAuthorizationCredentials | None) -> None:
    """Validate internal API key."""
    if not config.ANALYZER_API_KEY:
        return  # no key configured — open in dev
    if credentials is None or credentials.credentials != config.ANALYZER_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Analyzer microservice starting up.")
    yield
    log.info("Analyzer microservice shutting down.")


app = FastAPI(
    title="Visiblee Analyzer",
    description="AI analysis, scoring, and embedding microservice for Visiblee",
    version="0.2.0",
    lifespan=lifespan,
)


@app.get("/api/v1/health")
async def health() -> dict:
    """Health check endpoint."""
    return {"status": "ok"}


@app.post("/api/v1/preview-analyze", response_model=PreviewAnalyzeResponse)
async def preview_analyze(
    request: PreviewAnalyzeRequest,
    credentials: HTTPAuthorizationCredentials | None = Security(security),
) -> PreviewAnalyzeResponse:
    """
    Run the full preview analysis pipeline for a given website.
    Called by the Next.js worker or directly for testing.
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
