"""
Citation Stats — Bayesian Beta(α, β) model for citation rate estimation.

Given a history of citation checks (cited=True/False), computes:
  - Posterior mean (rate)
  - 95% credible interval [lower, upper] via normal approximation of Beta posterior
  - intervalWidth = upper - lower
  - label: "stable" | "learning" | "uncertain"
  - trend: "up" | "down" | "flat"
  - stability: bool (True when interval is narrow)
  - totalChecks: int

Prior: Beta(1, 1) — uniform, equivalent to one virtual success and one virtual failure.

This module is used as the reference implementation.
The same algorithm is implemented in the Next.js API route (citation-stats/route.ts).
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from typing import TypedDict


class CitationStats(TypedDict):
    rate: float
    lower: float
    upper: float
    intervalWidth: float
    label: str          # "stable" | "learning" | "uncertain"
    trend: str          # "up" | "down" | "flat"
    stability: bool
    totalChecks: int


# Thresholds for interval-width labelling
_STABLE_MAX = 0.20
_LEARNING_MAX = 0.40


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def compute_citation_stats(
    checks: list[dict],  # each: {"userCited": bool, "checkedAt": datetime}
    z: float = 1.96,     # 95% credible interval
) -> CitationStats:
    """
    Compute Bayesian citation stats from a list of citation check records.

    Args:
        checks: list of dicts with keys `userCited` (bool) and `checkedAt` (datetime).
        z: number of standard deviations for the credible interval (default 1.96 → 95%).

    Returns:
        CitationStats TypedDict.
    """
    n = len(checks)

    # ── Posterior parameters (uniform prior: α₀=1, β₀=1) ──────────────────
    cited = sum(1 for c in checks if c["userCited"])
    not_cited = n - cited

    alpha = cited + 1
    beta = not_cited + 1
    n_post = alpha + beta  # = n + 2

    rate = alpha / n_post
    variance = (alpha * beta) / (n_post ** 2 * (n_post + 1))
    std = math.sqrt(variance)

    lower = _clamp(rate - z * std, 0.0, 1.0)
    upper = _clamp(rate + z * std, 0.0, 1.0)
    interval_width = upper - lower

    # ── Label ──────────────────────────────────────────────────────────────
    if interval_width <= _STABLE_MAX:
        label = "stable"
    elif interval_width <= _LEARNING_MAX:
        label = "learning"
    else:
        label = "uncertain"

    stability = interval_width <= _STABLE_MAX

    # ── Trend: last 7 days vs previous 7 days ──────────────────────────────
    now = datetime.now(timezone.utc)
    cutoff_recent = now - timedelta(days=7)
    cutoff_prev = now - timedelta(days=14)

    recent = [c for c in checks if c["checkedAt"] >= cutoff_recent]
    prev = [c for c in checks if cutoff_prev <= c["checkedAt"] < cutoff_recent]

    def _rate(batch: list[dict]) -> float | None:
        if not batch:
            return None
        return sum(1 for c in batch if c["userCited"]) / len(batch)

    r_recent = _rate(recent)
    r_prev = _rate(prev)

    if r_recent is None or r_prev is None:
        trend = "flat"
    elif r_recent > r_prev + 0.05:
        trend = "up"
    elif r_recent < r_prev - 0.05:
        trend = "down"
    else:
        trend = "flat"

    return CitationStats(
        rate=round(rate, 4),
        lower=round(lower, 4),
        upper=round(upper, 4),
        intervalWidth=round(interval_width, 4),
        label=label,
        trend=trend,
        stability=stability,
        totalChecks=n,
    )
