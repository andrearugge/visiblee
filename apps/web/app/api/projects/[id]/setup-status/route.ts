import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const project = await db.project.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [queryCount, contentCount, confirmedCount, discoveryJob, analysisJob, snapshot, gscConnection] = await Promise.all([
    db.targetQuery.count({ where: { projectId: id, isActive: true } }),
    db.content.count({ where: { projectId: id } }),
    db.content.count({ where: { projectId: id, isConfirmed: true } }),
    db.job.findFirst({
      where: { projectId: id, type: 'discovery', status: { in: ['pending', 'running'] } },
      select: { id: true },
    }),
    db.job.findFirst({
      where: { projectId: id, type: 'full_analysis', status: { in: ['pending', 'running'] } },
      select: { id: true },
    }),
    db.projectScoreSnapshot.findFirst({
      where: { projectId: id },
      select: { id: true },
    }),
    db.gscConnection.findFirst({
      where: { projectId: id },
      select: { id: true },
    }),
  ]);

  return NextResponse.json({
    queryCount,
    contentCount,
    confirmedCount,
    discoveryRunning: !!discoveryJob,
    analysisRunning: !!analysisJob,
    hasSnapshot: !!snapshot,
    gscConnected: !!gscConnection,
  });
}
