import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * GET /api/projects/[id]/citation-stats?queryId=...
 *
 * Returns the Bayesian Beta(α, β) citation rate estimate for a single target query.
 * Algorithm mirrors services/analyzer/app/citation_stats.py.
 *
 * Response:
 *   { rate, lower, upper, intervalWidth, label, trend, stability, totalChecks }
 *
 * Prior: Beta(1,1) — uniform. One virtual success + one virtual failure.
 */

// ── Beta posterior helpers ────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

interface CitationStats {
  rate: number;
  lower: number;
  upper: number;
  intervalWidth: number;
  label: 'stable' | 'learning' | 'uncertain';
  trend: 'up' | 'down' | 'flat';
  stability: boolean;
  totalChecks: number;
}

function computeCitationStats(
  checks: { userCited: boolean; checkedAt: Date }[],
  z = 1.96,
): CitationStats {
  const n = checks.length;
  const cited = checks.filter((c) => c.userCited).length;
  const notCited = n - cited;

  // Uniform prior: α₀ = 1, β₀ = 1
  const alpha = cited + 1;
  const beta = notCited + 1;
  const nPost = alpha + beta; // n + 2

  const rate = alpha / nPost;
  const variance = (alpha * beta) / (nPost ** 2 * (nPost + 1));
  const std = Math.sqrt(variance);

  const lower = clamp(rate - z * std, 0, 1);
  const upper = clamp(rate + z * std, 0, 1);
  const intervalWidth = upper - lower;

  const label: CitationStats['label'] =
    intervalWidth <= 0.2 ? 'stable' : intervalWidth <= 0.4 ? 'learning' : 'uncertain';

  const stability = intervalWidth <= 0.2;

  // Trend: last 7 days vs previous 7 days
  const now = Date.now();
  const cutoffRecent = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const cutoffPrev = new Date(now - 14 * 24 * 60 * 60 * 1000);

  const recent = checks.filter((c) => c.checkedAt >= cutoffRecent);
  const prev = checks.filter((c) => c.checkedAt >= cutoffPrev && c.checkedAt < cutoffRecent);

  const rateOf = (batch: typeof checks) =>
    batch.length === 0 ? null : batch.filter((c) => c.userCited).length / batch.length;

  const rRecent = rateOf(recent);
  const rPrev = rateOf(prev);

  let trend: CitationStats['trend'] = 'flat';
  if (rRecent !== null && rPrev !== null) {
    if (rRecent > rPrev + 0.05) trend = 'up';
    else if (rRecent < rPrev - 0.05) trend = 'down';
  }

  const round4 = (v: number) => Math.round(v * 10000) / 10000;

  return {
    rate: round4(rate),
    lower: round4(lower),
    upper: round4(upper),
    intervalWidth: round4(intervalWidth),
    label,
    trend,
    stability,
    totalChecks: n,
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const queryId = searchParams.get('queryId');

  if (!queryId) {
    return NextResponse.json({ error: 'Missing queryId' }, { status: 400 });
  }

  // Verify project ownership
  const project = await db.project.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Verify query belongs to project
  const targetQuery = await db.targetQuery.findFirst({
    where: { id: queryId, projectId: id },
    select: { id: true },
  });
  if (!targetQuery) return NextResponse.json({ error: 'Query not found' }, { status: 404 });

  // Fetch all citation checks for this query (all time, for the Beta model)
  const checks = await db.citationCheck.findMany({
    where: { targetQueryId: queryId, projectId: id },
    select: { userCited: true, checkedAt: true },
    orderBy: { checkedAt: 'asc' },
  });

  const stats = computeCitationStats(checks);

  return NextResponse.json(stats);
}
