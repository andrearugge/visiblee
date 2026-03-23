import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { ContentDetailClient } from '@/components/features/content-detail-client';

interface Props {
  params: Promise<{ id: string; cId: string }>;
}

export default async function ContentDetailPage({ params }: Props) {
  const [session, { id, cId }] = await Promise.all([auth(), params]);
  if (!session) return null;

  const latestSnapshot = await db.projectScoreSnapshot.findFirst({
    where: { projectId: id },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });

  const content = await db.content.findFirst({
    where: {
      id: cId,
      projectId: id,
      project: { userId: session.user.id },
    },
    select: {
      id: true,
      url: true,
      title: true,
      platform: true,
      contentType: true,
      wordCount: true,
      lastFetchedAt: true,
      createdAt: true,
      passages: {
        orderBy: { passageIndex: 'asc' },
        select: {
          id: true,
          passageText: true,
          passageIndex: true,
          wordCount: true,
          heading: true,
          passageScores: latestSnapshot
            ? {
                where: { snapshotId: latestSnapshot.id },
                select: {
                  overallScore: true,
                  positionScore: true,
                  entityDensity: true,
                  statisticalSpecificity: true,
                  definiteness: true,
                  sourceCitation: true,
                  llmReasoning: true,
                },
                take: 1,
              }
            : false,
        },
      },
    },
  });

  if (!content) notFound();

  const data = {
    ...content,
    lastFetchedAt: content.lastFetchedAt?.toISOString() ?? null,
    createdAt: content.createdAt.toISOString(),
    passages: content.passages.map((p) => ({
      ...p,
      passageScores: Array.isArray(p.passageScores) ? p.passageScores : [],
    })),
  };

  return <ContentDetailClient data={data} projectId={id} />;
}
