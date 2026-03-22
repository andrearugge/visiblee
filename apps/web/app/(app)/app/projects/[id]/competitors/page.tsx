import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { CompetitorsClient } from '@/components/features/competitors-client';

interface CompetitorsPageProps {
  params: Promise<{ id: string }>;
}

export default async function CompetitorsPage({ params }: CompetitorsPageProps) {
  const [session, { id }] = await Promise.all([auth(), params]);

  const project = await db.project.findFirst({
    where: { id, userId: session!.user.id },
    select: { id: true },
  });
  if (!project) notFound();

  const [competitors, latestSnapshot] = await Promise.all([
    db.competitor.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'asc' },
      include: { contents: { select: { id: true } } },
    }),
    db.projectScoreSnapshot.findFirst({
      where: { projectId: id },
      orderBy: { createdAt: 'desc' },
      select: { passageQualityScore: true },
    }),
  ]);

  const serialized = competitors.map((c) => ({
    id: c.id,
    name: c.name,
    websiteUrl: c.websiteUrl,
    isConfirmed: c.isConfirmed,
    avgPassageScore: c.avgPassageScore,
    contentCount: c.contents.length,
    createdAt: c.createdAt.toISOString(),
  }));

  return (
    <CompetitorsClient
      projectId={id}
      initialCompetitors={serialized}
      ownPassageScore={latestSnapshot?.passageQualityScore ?? null}
    />
  );
}
