import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { CompetitorsClient } from '@/components/features/competitors-client';

interface CompetitorsPageProps {
  params: Promise<{ id: string }>;
}

interface CitedSource {
  url: string;
  domain: string;
  title: string;
  is_user: boolean;
  is_competitor: boolean;
  position: number;
}

export default async function CompetitorsPage({ params }: CompetitorsPageProps) {
  const [session, { id }] = await Promise.all([auth(), params]);

  const project = await db.project.findFirst({
    where: { id, userId: session!.user.id },
    select: { id: true },
  });
  if (!project) notFound();

  const [competitors, appearances, latestSnapshot, gapReports] = await Promise.all([
    db.competitor.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'asc' },
      include: { contents: { select: { id: true } } },
    }),
    db.competitorQueryAppearance.findMany({
      where: { competitor: { projectId: id } },
      select: {
        competitorId: true,
        targetQuery: { select: { id: true, queryText: true } },
        citationCheck: { select: { citedSources: true } },
      },
      orderBy: { checkedAt: 'desc' },
    }),
    db.projectScoreSnapshot.findFirst({
      where: { projectId: id },
      orderBy: { createdAt: 'desc' },
      select: { citationPowerScore: true },
    }),
    db.competitorGapReport.findMany({
      where: { projectId: id },
      orderBy: { generatedAt: 'desc' },
      select: { competitorId: true, generatedAt: true, gaps: true },
    }),
  ]);

  // Build per-competitor URL and query sets
  const urlsByCompetitor = new Map<string, Set<string>>();
  const queriesByCompetitor = new Map<string, Set<string>>();

  for (const app of appearances) {
    const comp = competitors.find((c) => c.id === app.competitorId);
    if (!comp) continue;

    let compDomain: string | null = null;
    if (comp.websiteUrl) {
      try {
        compDomain = new URL(comp.websiteUrl).hostname.replace(/^www\./, '');
      } catch {}
    }

    const sources = app.citationCheck.citedSources as unknown as CitedSource[];
    const compSources = sources.filter((s) => {
      if (s.is_user) return false;
      if (!s.is_competitor) return false;
      if (compDomain) {
        const srcDomain = s.domain.replace(/^www\./, '');
        return srcDomain.includes(compDomain) || compDomain.includes(srcDomain);
      }
      return true;
    });

    const urlSet = urlsByCompetitor.get(app.competitorId) ?? new Set<string>();
    for (const s of compSources) urlSet.add(s.url);
    urlsByCompetitor.set(app.competitorId, urlSet);

    const querySet = queriesByCompetitor.get(app.competitorId) ?? new Set<string>();
    querySet.add(app.targetQuery.queryText);
    queriesByCompetitor.set(app.competitorId, querySet);
  }

  // Latest gap report per competitor (first entry is most recent due to orderBy desc)
  const latestGapByCompetitor = new Map<string, { gaps: unknown; generatedAt: string }>();
  for (const gr of gapReports) {
    if (!latestGapByCompetitor.has(gr.competitorId)) {
      latestGapByCompetitor.set(gr.competitorId, {
        gaps: gr.gaps,
        generatedAt: gr.generatedAt.toISOString(),
      });
    }
  }

  const serialized = competitors.map((c) => ({
    id: c.id,
    name: c.name,
    websiteUrl: c.websiteUrl,
    isConfirmed: c.isConfirmed,
    avgPassageScore: c.avgPassageScore,
    contentCount: c.contents.length,
    createdAt: c.createdAt.toISOString(),
    citationUrls: [...(urlsByCompetitor.get(c.id) ?? [])],
    queriesWithCitations: [...(queriesByCompetitor.get(c.id) ?? [])],
    gapReport: latestGapByCompetitor.get(c.id) ?? null,
  }));

  return (
    <CompetitorsClient
      projectId={id}
      initialCompetitors={serialized}
      ownPassageScore={latestSnapshot?.citationPowerScore ?? null}
    />
  );
}
