import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { ConvertedBanner } from '@/components/features/converted-banner';
import { OverviewDashboard } from '@/components/features/overview-dashboard';
import { OverviewEmpty } from '@/components/features/overview-empty';
import { ScoreHistoryChart } from '@/components/features/score-history-chart';

interface OverviewPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ converted?: string }>;
}

export default async function OverviewPage({ params, searchParams }: OverviewPageProps) {
  const [session, { id }, { converted }, t] = await Promise.all([
    auth(),
    params,
    searchParams,
    getTranslations('overview'),
  ]);

  const project = await db.project.findFirst({
    where: { id, userId: session!.user.id },
    select: { id: true },
  });
  if (!project) notFound();

  const [snapshot, activeJob, confirmedContentCount, allSnapshots] = await Promise.all([
    db.projectScoreSnapshot.findFirst({
      where: { projectId: id },
      orderBy: { createdAt: 'desc' },
    }),
    db.job.findFirst({
      where: { projectId: id, type: 'full_analysis', status: { in: ['pending', 'running'] } },
      select: { id: true },
    }),
    db.content.count({
      where: { projectId: id, isConfirmed: true },
    }),
    db.projectScoreSnapshot.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'asc' },
      take: 50,
      select: {
        id: true,
        createdAt: true,
        aiReadinessScore: true,
        fanoutCoverageScore: true,
        citationPowerScore: true,
        extractabilityScore: true,
        entityAuthorityScore: true,
        sourceAuthorityScore: true,
      },
    }),
  ]);

  const serializedSnapshots = allSnapshots.map((s) => ({
    ...s,
    createdAt: s.createdAt.toISOString(),
  }));

  return (
    <div>
      {converted === 'true' && (
        <div className="px-6 pt-6">
          <ConvertedBanner
            title={t('convertedBannerTitle')}
            subtitle={t('convertedBannerSubtitle')}
          />
        </div>
      )}

      {snapshot ? (
        <>
          <OverviewDashboard
            projectId={id}
            initialAnalysisRunning={!!activeJob}
            snapshot={{
              aiReadinessScore: snapshot.aiReadinessScore,
              fanoutCoverageScore: snapshot.fanoutCoverageScore,
              citationPowerScore: snapshot.citationPowerScore,
              extractabilityScore: snapshot.extractabilityScore,
              entityAuthorityScore: snapshot.entityAuthorityScore,
              sourceAuthorityScore: snapshot.sourceAuthorityScore,
              createdAt: snapshot.createdAt.toISOString(),
            }}
          />
          {serializedSnapshots.length >= 2 && (
            <div className="px-6 pb-6">
              <ScoreHistoryChart snapshots={serializedSnapshots} />
            </div>
          )}
        </>
      ) : (
        <OverviewEmpty
          projectId={id}
          hasContent={confirmedContentCount > 0}
          initialAnalysisRunning={!!activeJob}
        />
      )}
    </div>
  );
}
