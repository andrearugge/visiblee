import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { ContentsClient } from '@/components/features/contents-client';

export default async function ContentsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect('/login');

  const { id } = await params;

  const project = await db.project.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, targetLanguage: true },
  });

  if (!project) notFound();

  const contents = await db.content.findMany({
    where: { projectId: id },
    select: {
      id: true,
      url: true,
      title: true,
      platform: true,
      contentType: true,
      isConfirmed: true,
      isIndexed: true,
      wordCount: true,
      discoveryConfidence: true,
      detectedLanguage: true,
      lastFetchedAt: true,
      _count: { select: { passages: true } },
    },
    orderBy: [{ isConfirmed: 'asc' }, { discoveryConfidence: 'desc' }, { createdAt: 'desc' }],
  });

  const serialized = contents.map((c) => ({
    ...c,
    lastFetchedAt: c.lastFetchedAt?.toISOString() ?? null,
  }));

  const [activeDiscovery, activeSitemapImport] = await Promise.all([
    db.job.findFirst({
      where: { projectId: id, type: 'discovery', status: { in: ['pending', 'running'] } },
      select: { id: true },
    }),
    db.job.findFirst({
      where: { projectId: id, type: 'sitemap_import', status: { in: ['pending', 'running'] } },
      select: { id: true },
    }),
  ]);

  return (
    <ContentsClient
      projectId={id}
      targetLanguage={project.targetLanguage}
      initialContents={serialized}
      initialDiscoveryRunning={!!activeDiscovery}
      initialSitemapRunning={!!activeSitemapImport}
    />
  );
}
