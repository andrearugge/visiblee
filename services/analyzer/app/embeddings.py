"""
Voyage AI embeddings + cosine similarity utilities.
"""

import asyncio
from typing import Any

import numpy as np

from .config import config

try:
    import voyageai
    _voyage_client = voyageai.AsyncClient(api_key=config.VOYAGE_API_KEY) if config.VOYAGE_API_KEY else None
except ImportError:
    _voyage_client = None


async def embed_texts(texts: list[str], input_type: str = "document") -> list[list[float]]:
    """Embed a list of texts using Voyage AI voyage-3-large."""
    if not _voyage_client or not texts:
        # Return zero vectors as fallback
        return [[0.0] * 1024 for _ in texts]

    # Batch in chunks of 128 (Voyage limit)
    all_embeddings: list[list[float]] = []
    batch_size = 128
    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        result = await _voyage_client.embed(batch, model="voyage-3-large", input_type=input_type)
        all_embeddings.extend(result.embeddings)

    return all_embeddings


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    va = np.array(a, dtype=np.float32)
    vb = np.array(b, dtype=np.float32)
    norm_a = np.linalg.norm(va)
    norm_b = np.linalg.norm(vb)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(va, vb) / (norm_a * norm_b))


def compute_coverage(
    query_embeddings: list[list[float]],
    passage_embeddings: list[list[float]],
    threshold: float,
) -> tuple[float, list[dict[str, Any]]]:
    """
    For each query, find the best-matching passage.
    Returns (coverage_ratio, coverage_map).
    coverage_ratio = fraction of queries covered above threshold.
    """
    coverage_map: list[dict[str, Any]] = []
    covered = 0

    for q_idx, q_emb in enumerate(query_embeddings):
        best_score = 0.0
        best_passage_idx = -1
        for p_idx, p_emb in enumerate(passage_embeddings):
            sim = cosine_similarity(q_emb, p_emb)
            if sim > best_score:
                best_score = sim
                best_passage_idx = p_idx

        is_covered = best_score >= threshold
        if is_covered:
            covered += 1

        coverage_map.append({
            "query_index": q_idx,
            "best_passage_index": best_passage_idx,
            "similarity_score": round(best_score, 4),
            "is_covered": is_covered,
        })

    ratio = covered / len(query_embeddings) if query_embeddings else 0.0
    return ratio, coverage_map
