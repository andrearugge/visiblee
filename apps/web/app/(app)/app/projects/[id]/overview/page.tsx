import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { ConvertedBanner } from '@/components/features/converted-banner';
import { OverviewDashboard } from '@/components/features/overview-dashboard';
import { OverviewEmpty } from '@/components/features/overview-empty';
import { ScoreHistoryChart } from '@/components/features/score-history-chart';
import { CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

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

  const gscEnabled = process.env.NEXT_PUBLIC_GSC_ENABLED === 'true';

  const [snapshot, activeJob, confirmedContentCount, allSnapshots, queryCount, contentCount, discoveryJob, topCompetitorData, citationGapData, gscConnection] = await Promise.all([
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
    db.targetQuery.count({ where: { projectId: id, isActive: true } }),
    db.content.count({ where: { projectId: id } }),
    db.job.findFirst({
      where: { projectId: id, type: 'discovery', status: { in: ['pending', 'running'] } },
      select: { id: true },
    }),
    // Top competitors: count distinct targetQueryId per competitor
    db.competitorQueryAppearance.findMany({
      where: { targetQuery: { projectId: id } },
      include: { competitor: { select: { id: true, name: true, websiteUrl: true } } },
    }),
    // Citation gaps: latest check per active query
    db.targetQuery.findMany({
      where: { projectId: id, isActive: true },
      select: {
        id: true,
        queryText: true,
        citationChecks: {
          orderBy: { checkedAt: 'desc' },
          take: 1,
          select: { userCited: true, checkedAt: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
    gscEnabled
      ? db.gscConnection.findFirst({ where: { projectId: id }, select: { id: true } })
      : Promise.resolve(null),
  ]);

  const serializedSnapshots = allSnapshots.map((s) => ({
    ...s,
    createdAt: s.createdAt.toISOString(),
  }));

  // Aggregate top competitors across all queries
  const competitorMap = new Map<
    string,
    { name: string; websiteUrl: string | null; queryIds: Set<string>; appearances: number }
  >();
  for (const a of topCompetitorData) {
    const prev = competitorMap.get(a.competitorId);
    if (prev) {
      prev.queryIds.add(a.targetQueryId);
      prev.appearances += 1;
    } else {
      competitorMap.set(a.competitorId, {
        name: a.competitor.name,
        websiteUrl: a.competitor.websiteUrl,
        queryIds: new Set([a.targetQueryId]),
        appearances: 1,
      });
    }
  }
  const topCompetitors = [...competitorMap.values()]
    .sort((a, b) => b.appearances - a.appearances)
    .slice(0, 5)
    .map((c) => ({ ...c, queryCount: c.queryIds.size }));

  // Citation gaps: queries with latest check = not cited OR no check at all
  const citationGaps = citationGapData
    .filter((q) => q.citationChecks.length === 0 || !q.citationChecks[0].userCited)
    .slice(0, 5);
  const citationCited = citationGapData.filter(
    (q) => q.citationChecks.length > 0 && q.citationChecks[0].userCited,
  ).length;

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

          {/* Aggregator widgets */}
          <div className="grid grid-cols-1 gap-4 px-6 pb-6 lg:grid-cols-2">
            {/* Top competitors */}
            <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-sm">
              <div className="border-b border-zinc-100 px-5 py-4">
                <p className="text-sm font-semibold text-zinc-900">{t('topCompetitorsTitle')}</p>
                <p className="mt-0.5 text-xs text-zinc-400">{t('topCompetitorsSubtitle')}</p>
              </div>
              {topCompetitors.length === 0 ? (
                <p className="px-5 py-8 text-center text-xs text-zinc-400">{t('topCompetitorsEmpty')}</p>
              ) : (
                <ul className="divide-y divide-zinc-50">
                  {topCompetitors.map((c, i) => (
                    <li key={i} className="flex items-center gap-3 px-5 py-3">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-500">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-800">{c.name}</p>
                        {c.websiteUrl && (
                          <a
                            href={c.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-0.5 text-xs text-zinc-400 hover:text-zinc-600"
                          >
                            <ExternalLink className="size-2.5" />
                            {c.websiteUrl.replace(/^https?:\/\//, '')}
                          </a>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs font-semibold tabular-nums text-zinc-700">
                          {t('topCompetitorsAppearances', { count: c.appearances })}
                        </p>
                        <p className="text-xs text-zinc-400">
                          {t('topCompetitorsQueries', { count: c.queryCount })}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Citation gaps */}
            <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-sm">
              <div className="border-b border-zinc-100 px-5 py-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">{t('citationGapsTitle')}</p>
                    <p className="mt-0.5 text-xs text-zinc-400">{t('citationGapsSubtitle')}</p>
                  </div>
                  {citationCited > 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                      <CheckCircle2 className="size-3" />
                      {citationCited} {t('citationGapsCited')}
                    </span>
                  )}
                </div>
              </div>
              {citationGaps.length === 0 ? (
                <p className="px-5 py-8 text-center text-xs text-zinc-400">{t('citationGapsEmpty')}</p>
              ) : (
                <ul className="divide-y divide-zinc-50">
                  {citationGaps.map((q) => (
                    <li key={q.id} className="flex items-center gap-3 px-5 py-3">
                      <XCircle className="size-4 shrink-0 text-red-400" />
                      <p className="min-w-0 flex-1 truncate text-sm text-zinc-700">{q.queryText}</p>
                      <Link
                        href={`/app/projects/${id}/queries/${q.id}/citations`}
                        className="shrink-0 text-xs text-zinc-400 transition-colors hover:text-zinc-700"
                      >
                        {t('citationGapsRunCheck')}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      ) : (
        <OverviewEmpty
          projectId={id}
          hasContent={confirmedContentCount > 0}
          initialAnalysisRunning={!!activeJob}
          initialQueryCount={queryCount}
          initialContentCount={contentCount}
          initialConfirmedCount={confirmedContentCount}
          initialDiscoveryRunning={!!discoveryJob}
          initialGscConnected={!!gscConnection}
          gscEnabled={gscEnabled}
        />
      )}
    </div>
  );
}
