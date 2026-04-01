import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { OptimizationClient } from '@/components/features/optimization-client';

interface Props {
  params: Promise<{ id: string; queryId: string }>;
}

export default async function QueryRecommendationsPage({ params }: Props) {
  const [session, { id, queryId }, t] = await Promise.all([
    auth(),
    params,
    getTranslations('optimization'),
  ]);

  const targetQuery = await db.targetQuery.findFirst({
    where: { id: queryId, project: { id, userId: session!.user.id } },
    select: { id: true },
  });
  if (!targetQuery) notFound();

  const [recommendations, latestSnapshot] = await Promise.all([
    db.recommendation.findMany({
      where: { projectId: id, targetQueryId: queryId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        priority: true,
        effort: true,
        title: true,
        description: true,
        suggestedAction: true,
        targetScore: true,
        status: true,
        snapshotId: true,
      },
    }),
    db.projectScoreSnapshot.findFirst({
      where: { projectId: id },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    }),
  ]);

  if (recommendations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <p className="text-lg font-semibold text-zinc-800">{t('emptyStateTitle')}</p>
        <p className="mt-2 max-w-sm text-sm text-zinc-500">{t('emptyStateSubtitle')}</p>
        <Link
          href={`/app/projects/${id}/overview`}
          className="mt-6 inline-flex items-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
        >
          {t('emptyStateCta')}
        </Link>
      </div>
    );
  }

  const recSnapshotId = recommendations[0]?.snapshotId;
  const isStale = !!latestSnapshot && !!recSnapshotId && recSnapshotId !== latestSnapshot.id;

  return (
    <OptimizationClient
      projectId={id}
      isStale={isStale}
      recommendations={recommendations.map((r) => ({
        ...r,
        effort: r.effort ?? 'moderate',
        suggestedAction: r.suggestedAction ?? null,
        targetScore: r.targetScore ?? null,
      }))}
    />
  );
}
