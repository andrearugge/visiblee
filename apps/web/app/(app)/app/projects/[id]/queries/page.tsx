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
      select: { id: true, queryText: true, isActive: true, createdAt: true },
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

  const serialized = queries.map((q) => ({
    ...q,
    createdAt: q.createdAt.toISOString(),
  }));

  return (
    <QueriesClient
      projectId={id}
      initialQueries={serialized}
      initialActiveCount={activeCount}
      snapshotCreatedAt={latestSnapshot?.createdAt.toISOString() ?? null}
      initialAnalysisRunning={!!activeJob}
    />
  );
}
