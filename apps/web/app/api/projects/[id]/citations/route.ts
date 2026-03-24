import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const project = await db.project.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Load active target queries with their latest citation check
  const targetQueries = await db.targetQuery.findMany({
    where: { projectId: id, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      queryText: true,
      citationChecks: {
        orderBy: { checkedAt: 'desc' },
        take: 1,
        select: {
          id: true,
          userCited: true,
          userCitedPosition: true,
          userCitedSegment: true,
          responseText: true,
          citedSources: true,
          searchQueries: true,
          checkedAt: true,
        },
      },
    },
  });

  // Compute 4-week trend for each query
  const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
  const trendChecks = await db.citationCheck.findMany({
    where: {
      projectId: id,
      checkedAt: { gte: fourWeeksAgo },
    },
    select: { targetQueryId: true, userCited: true, checkedAt: true },
    orderBy: { checkedAt: 'asc' },
  });

  // Group trend by query
  const trendByQuery = new Map<string, { userCited: boolean; checkedAt: Date }[]>();
  for (const c of trendChecks) {
    const arr = trendByQuery.get(c.targetQueryId) ?? [];
    arr.push({ userCited: c.userCited, checkedAt: c.checkedAt });
    trendByQuery.set(c.targetQueryId, arr);
  }

  const citations = targetQueries.map((tq) => {
    const check = tq.citationChecks[0] ?? null;
    const history = trendByQuery.get(tq.id) ?? [];

    // Bucket into 4 weekly slots (week 0 = most recent)
    const weeklySlots: boolean[] = Array(4).fill(false);
    for (const h of history) {
      const weeksAgo = Math.floor(
        (Date.now() - h.checkedAt.getTime()) / (7 * 24 * 60 * 60 * 1000),
      );
      if (weeksAgo < 4) weeklySlots[weeksAgo] = weeklySlots[weeksAgo] || h.userCited;
    }
    const citedWeeks = weeklySlots.filter(Boolean).length;

    return {
      targetQueryId: tq.id,
      queryText: tq.queryText,
      latestCheck: check
        ? {
            userCited: check.userCited,
            userCitedPosition: check.userCitedPosition,
            userCitedSegment: check.userCitedSegment,
            responseText: check.responseText,
            citedSources: check.citedSources,
            searchQueries: check.searchQueries,
            checkedAt: check.checkedAt.toISOString(),
          }
        : null,
      trend: {
        citedWeeks,
        totalWeeks: 4,
        history: weeklySlots.reverse(), // index 0 = 4 weeks ago, index 3 = latest
      },
    };
  });

  return NextResponse.json({ citations });
}
