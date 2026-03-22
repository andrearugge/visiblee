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

  const [queries, latestSnapshot, activeJob] = await Promise.all([
    db.targetQuery.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, queryText: true, isActive: true, createdAt: true, updatedAt: true },
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

  const activeCount = queries.filter((q) => q.isActive).length;

  // A query was changed (added or removed) after the last analysis snapshot.
  // If there's no snapshot at all and there are queries, prompt to run the first analysis.
  const lastSnapshotAt = latestSnapshot?.createdAt ?? null;
  const initialPendingChanges = queries.some((q) =>
    lastSnapshotAt === null || q.updatedAt > lastSnapshotAt,
  );

  const serialized = queries.map((q) => ({
    id: q.id,
    queryText: q.queryText,
    isActive: q.isActive,
    createdAt: q.createdAt.toISOString(),
  }));

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
