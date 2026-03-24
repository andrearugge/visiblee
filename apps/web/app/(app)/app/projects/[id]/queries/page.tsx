import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { QueriesClient } from '@/components/features/queries-client';

interface QueriesPageProps {
  params: Promise<{ id: string }>;
}

export default async function QueriesPage({ params }: QueriesPageProps) {
  const [session, { id }] = await Promise.all([auth(), params]);

  const project = await db.project.findFirst({
    where: { id, userId: session!.user.id },
    select: { id: true },
  });
  if (!project) notFound();

  const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);

  const [queries, latestSnapshot, activeJob] = await Promise.all([
    db.targetQuery.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        queryText: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        citationChecks: {
          orderBy: { checkedAt: 'desc' },
          take: 1,
          select: {
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
    }),
    db.projectScoreSnapshot.findFirst({
      where: { projectId: id },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
    db.job.findFirst({
      where: { projectId: id, type: 'full_analysis', status: { in: ['pending', 'running'] } },
      select: { id: true },
    }),
  ]);

  // 4-week trend data for all queries
  const trendChecks = await db.citationCheck.findMany({
    where: { projectId: id, checkedAt: { gte: fourWeeksAgo } },
    select: { targetQueryId: true, userCited: true, checkedAt: true },
    orderBy: { checkedAt: 'asc' },
  });

  const trendByQuery = new Map<string, { userCited: boolean; checkedAt: string }[]>();
  for (const c of trendChecks) {
    const arr = trendByQuery.get(c.targetQueryId) ?? [];
    arr.push({ userCited: c.userCited, checkedAt: c.checkedAt.toISOString() });
    trendByQuery.set(c.targetQueryId, arr);
  }

  const activeCount = queries.filter((q) => q.isActive).length;
  const lastSnapshotAt = latestSnapshot?.createdAt ?? null;
  const initialPendingChanges = queries.some(
    (q) => lastSnapshotAt === null || q.updatedAt > lastSnapshotAt,
  );

  const serialized = queries.map((q) => {
    const check = q.citationChecks[0] ?? null;
    const history = trendByQuery.get(q.id) ?? [];

    const weeklySlots: boolean[] = Array(4).fill(false);
    for (const h of history) {
      const weeksAgo = Math.floor(
        (Date.now() - new Date(h.checkedAt).getTime()) / (7 * 24 * 60 * 60 * 1000),
      );
      if (weeksAgo < 4) weeklySlots[weeksAgo] = weeklySlots[weeksAgo] || h.userCited;
    }

    return {
      id: q.id,
      queryText: q.queryText,
      isActive: q.isActive,
      createdAt: q.createdAt.toISOString(),
      citation: check
        ? {
            userCited: check.userCited,
            userCitedPosition: check.userCitedPosition,
            userCitedSegment: check.userCitedSegment,
            responseText: check.responseText,
            citedSources: check.citedSources as CitedSource[],
            searchQueries: check.searchQueries as string[],
            checkedAt: check.checkedAt.toISOString(),
            trend: {
              citedWeeks: weeklySlots.filter(Boolean).length,
              totalWeeks: 4,
              history: [...weeklySlots].reverse(),
            },
          }
        : null,
    };
  });

  return (
    <QueriesClient
      projectId={id}
      initialQueries={serialized}
      initialActiveCount={activeCount}
      snapshotCreatedAt={lastSnapshotAt?.toISOString() ?? null}
      initialAnalysisRunning={!!activeJob}
      initialPendingChanges={initialPendingChanges}
    />
  );
}

interface CitedSource {
  url: string;
  title: string;
  domain: string;
  is_user: boolean;
  is_competitor: boolean;
  position: number;
  supported_text: string | null;
}
