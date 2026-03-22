import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const project = await db.project.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const snapshots = await db.projectScoreSnapshot.findMany({
    where: { projectId: id },
    orderBy: { createdAt: 'asc' },
    take: 50,
    select: {
      id: true,
      createdAt: true,
      aiReadinessScore: true,
      fanoutCoverageScore: true,
      passageQualityScore: true,
      chunkabilityScore: true,
      entityCoherenceScore: true,
      crossPlatformScore: true,
    },
  });

  return NextResponse.json(snapshots);
}
