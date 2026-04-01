import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { computeCitationStats } from '@/lib/citation-stats';
import { QueryCitationsClient } from '@/components/features/query-citations-client';

interface Props {
  params: Promise<{ id: string; queryId: string }>;
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

export default async function QueryCitationsPage({ params }: Props) {
  const [session, { id, queryId }] = await Promise.all([auth(), params]);

  const targetQuery = await db.targetQuery.findFirst({
    where: { id: queryId, project: { id, userId: session!.user.id } },
    select: { id: true, isActive: true },
  });
  if (!targetQuery) notFound();

  const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);

  const [latestCheck, allChecks, trendChecks, activeJob] = await Promise.all([
    db.citationCheck.findFirst({
      where: { targetQueryId: queryId, projectId: id },
      orderBy: { checkedAt: 'desc' },
      select: {
        userCited: true,
        userCitedPosition: true,
        userCitedSegment: true,
        responseText: true,
        citedSources: true,
        searchQueries: true,
        checkedAt: true,
        variants: {
          select: {
            intentProfileId: true,
            userCited: true,
            userCitedPosition: true,
            intentProfile: { select: { name: true, slug: true } },
          },
        },
      },
    }),
    db.citationCheck.findMany({
      where: { targetQueryId: queryId, projectId: id },
      select: { userCited: true, checkedAt: true },
      orderBy: { checkedAt: 'asc' },
    }),
    db.citationCheck.findMany({
      where: { targetQueryId: queryId, projectId: id, checkedAt: { gte: fourWeeksAgo } },
      select: { userCited: true, checkedAt: true },
      orderBy: { checkedAt: 'asc' },
    }),
    db.job.findFirst({
      where: {
        projectId: id,
        type: { in: ['citation_check', 'citation_check_enriched'] },
        status: { in: ['pending', 'running'] },
        payload: { path: ['targetQueryId'], equals: queryId },
      },
      select: { id: true },
    }),
  ]);

  const citationStats = allChecks.length > 0 ? computeCitationStats(allChecks) : null;

  // Build 4-week trend
  const weeklySlots: boolean[] = Array(4).fill(false);
  for (const h of trendChecks) {
    const weeksAgo = Math.floor(
      (Date.now() - h.checkedAt.getTime()) / (7 * 24 * 60 * 60 * 1000),
    );
    if (weeksAgo < 4) weeklySlots[weeksAgo] = weeklySlots[weeksAgo] || h.userCited;
  }

  const trend = {
    citedWeeks: weeklySlots.filter(Boolean).length,
    totalWeeks: 4,
    history: [...weeklySlots].reverse(),
  };

  const citation = latestCheck
    ? {
        userCited: latestCheck.userCited,
        userCitedPosition: latestCheck.userCitedPosition,
        userCitedSegment: latestCheck.userCitedSegment,
        responseText: latestCheck.responseText,
        citedSources: latestCheck.citedSources as unknown as CitedSource[],
        searchQueries: latestCheck.searchQueries as unknown as string[],
        checkedAt: latestCheck.checkedAt.toISOString(),
        variants: (latestCheck.variants ?? []).map((v) => ({
          intentProfileId: v.intentProfileId,
          profileName: v.intentProfile.name,
          profileSlug: v.intentProfile.slug,
          userCited: v.userCited,
          userCitedPosition: v.userCitedPosition,
        })),
      }
    : null;

  return (
    <QueryCitationsClient
      projectId={id}
      queryId={queryId}
      citation={citation}
      trend={allChecks.length > 0 ? trend : null}
      citationStats={citationStats}
      jobRunning={!!activeJob}
    />
  );
}
