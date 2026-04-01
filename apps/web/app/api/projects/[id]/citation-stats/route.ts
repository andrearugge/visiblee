import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { computeCitationStats } from '@/lib/citation-stats';

/**
 * GET /api/projects/[id]/citation-stats?queryId=...
 *
 * Returns the Bayesian Beta(α, β) citation rate estimate for a single target query.
 * Response: { rate, lower, upper, intervalWidth, label, trend, stability, totalChecks }
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const queryId = searchParams.get('queryId');

  if (!queryId) {
    return NextResponse.json({ error: 'Missing queryId' }, { status: 400 });
  }

  const project = await db.project.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const targetQuery = await db.targetQuery.findFirst({
    where: { id: queryId, projectId: id },
    select: { id: true },
  });
  if (!targetQuery) return NextResponse.json({ error: 'Query not found' }, { status: 404 });

  const checks = await db.citationCheck.findMany({
    where: { targetQueryId: queryId, projectId: id },
    select: { userCited: true, checkedAt: true },
    orderBy: { checkedAt: 'asc' },
  });

  return NextResponse.json(computeCitationStats(checks));
}
