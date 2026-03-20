import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations, getLocale } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { OpportunityMapClient } from '@/components/features/opportunity-map-client';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function OpportunitiesPage({ params }: Props) {
  const [session, { id }, t, locale] = await Promise.all([
    auth(),
    params,
    getTranslations('opportunities'),
    getLocale(),
  ]);

  const project = await db.project.findFirst({
    where: { id, userId: session!.user.id },
    select: { id: true },
  });
  if (!project) notFound();

  const snapshot = await db.projectScoreSnapshot.findFirst({
    where: { projectId: id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, createdAt: true, fanoutCoverageScore: true },
  });

  // No snapshot yet → empty state
  if (!snapshot) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <p className="text-lg font-semibold text-zinc-800">{t('emptyStateTitle')}</p>
        <p className="mt-2 max-w-sm text-sm text-zinc-500">{t('emptyStateSubtitle')}</p>
        <Link
          href={`/app/projects/${id}/overview`}
          className="mt-6 inline-flex items-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
        >
          {t('emptyStateCta')}
        </Link>
      </div>
    );
  }

  // Load target queries with fanout queries for this snapshot
  const targetQueries = await db.targetQuery.findMany({
    where: { projectId: id, isActive: true },
    include: {
      fanoutQueries: {
        where: { batchId: snapshot.id },
        include: {
          coverageMap: {
            orderBy: { similarityScore: 'desc' },
            take: 1,
          },
        },
        orderBy: { generatedAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const allFanout = targetQueries.flatMap((tq) => tq.fanoutQueries);
  const totalFanout = allFanout.length;
  const coveredFanout = allFanout.filter((fq) => fq.coverageMap[0]?.isCovered).length;

  return (
    <OpportunityMapClient
      targetQueries={targetQueries.map((tq) => ({
        id: tq.id,
        queryText: tq.queryText,
        fanoutQueries: tq.fanoutQueries.map((fq) => ({
          id: fq.id,
          queryText: fq.queryText,
          queryType: fq.queryType,
          similarityScore: fq.coverageMap[0]?.similarityScore ?? null,
          isCovered: fq.coverageMap[0]?.isCovered ?? null,
        })),
      }))}
      totalFanout={totalFanout}
      coveredFanout={coveredFanout}
      snapshotCreatedAt={snapshot.createdAt.toISOString()}
      locale={locale}
    />
  );
}
