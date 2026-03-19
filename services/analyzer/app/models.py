from __future__ import annotations

"""
Pydantic schemas for request/response validation.
"""

from typing import Any
from pydantic import BaseModel, HttpUrl, field_validator


class PreviewAnalyzeRequest(BaseModel):
    website_url: str
    brand_name: str
    query_targets: list[str]
    language: str = "en"

    @field_validator("query_targets")
    @classmethod
    def validate_queries(cls, v: list[str]) -> list[str]:
        cleaned = [q.strip() for q in v if q.strip()]
        if not cleaned:
            raise ValueError("At least one query is required")
        if len(cleaned) > 5:
            raise ValueError("Maximum 5 queries allowed")
        return cleaned


class ScoreBreakdown(BaseModel):
    ai_readiness_score: float
    fanout_coverage_score: float
    passage_quality_score: float
    chunkability_score: float
    entity_coherence_score: float
    cross_platform_score: float


class PreviewAnalyzeResponse(BaseModel):
    scores: ScoreBreakdown
    insights: list[str]
    contents_found: int
    analysis_data: dict[str, Any]


class DiscoverRequest(BaseModel):
    website_url: str
    brand_name: str
    language: str = "en"


class DiscoveredContent(BaseModel):
    url: str
    title: str
    snippet: str
    platform: str
    content_type: str
    confidence: float


class DiscoverResponse(BaseModel):
    results: list[DiscoveredContent]
    total: int


class FetchContentRequest(BaseModel):
    url: str


class PassageResult(BaseModel):
    passage_index: int
    passage_text: str
    word_count: int
    heading: str | None = None


class FetchContentResponse(BaseModel):
    url: str
    title: str | None
    word_count: int
    passages: list[PassageResult]
