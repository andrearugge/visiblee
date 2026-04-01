import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { AudienceInsightsPage } from '@/components/gsc/audience-insights-page';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AudiencePage({ params }: Props) {
  const [session, { id }] = await Promise.all([auth(), params]);

  const project = await db.project.findFirst({
    where: { id, userId: session!.user.id },
    select: { id: true },
  });
  if (!project) notFound();

  // Load GSC connection status
  const gscConnection = await db.gscConnection.findUnique({
    where: { projectId: id },
    select: {
      status: true,
      propertyUrl: true,
      lastSyncAt: true,
    },
  });

  // Check for pending gsc_sync job
  const pendingJob = await db.job.findFirst({
    where: { projectId: id, type: 'gsc_sync', status: { in: ['pending', 'running'] } },
    select: { id: true },
  });

  // Load intent profiles
  const intentProfiles = await db.intentProfile.findMany({
    where: { projectId: id, isActive: true },
    orderBy: [{ source: 'asc' }, { totalImpressions: 'desc' }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      source: true,
      dominantIntent: true,
      dominantDevice: true,
      dominantCountry: true,
      avgQueryLength: true,
      queryCount: true,
      totalImpressions: true,
      topPatterns: true,
      sampleQueries: true,
      citationVariants: {
        select: { userCited: true },
      },
    },
  });

  // Load target query count for citation impact calculation
  const targetQueryCount = await db.targetQuery.count({
    where: { projectId: id, isActive: true },
  });

  const totalImpressions = intentProfiles.reduce((sum, p) => sum + p.totalImpressions, 0);

  const serializedProfiles = intentProfiles.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    source: p.source,
    dominantIntent: p.dominantIntent,
    dominantDevice: p.dominantDevice,
    dominantCountry: p.dominantCountry,
    avgQueryLength: p.avgQueryLength,
    queryCount: p.queryCount,
    totalImpressions: p.totalImpressions,
    topPatterns: p.topPatterns as string[],
    sampleQueries: p.sampleQueries as string[],
    citedCount: p.citationVariants.filter((v) => v.userCited).length,
    totalTargetQueries: targetQueryCount,
  }));

  const connectionInfo = gscConnection
    ? {
        propertyUrl: gscConnection.propertyUrl,
        lastSyncAt: gscConnection.lastSyncAt?.toISOString() ?? null,
        status: gscConnection.status,
        pendingJobId: pendingJob?.id ?? null,
        queryCount: 0,
      }
    : null;

  return (
    <AudienceInsightsPage
      projectId={id}
      gscConnection={connectionInfo}
      intentProfiles={serializedProfiles}
      totalImpressions={totalImpressions}
    />
  );
}
