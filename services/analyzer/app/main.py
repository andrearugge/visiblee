"""
Visiblee — Python Analyzer Microservice
Handles AI analysis, scoring, embedding, and content processing.
"""

from fastapi import FastAPI

app = FastAPI(
    title="Visiblee Analyzer",
    description="AI analysis, scoring, and embedding microservice for Visiblee",
    version="0.1.0",
)


@app.get("/api/v1/health")
async def health() -> dict:
    """Health check endpoint."""
    return {"status": "ok"}
