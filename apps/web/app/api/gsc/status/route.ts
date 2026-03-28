import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const projectId = req.nextUrl.searchParams.get('projectId');
  if (!projectId) {
    return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
  }

  const [connection, pendingJob, queryCount, profileCount] = await Promise.all([
    db.gscConnection.findUnique({
      where: { projectId },
      select: {
        status: true,
        propertyUrl: true,
        propertyType: true,
        lastSyncAt: true,
        lastSyncError: true,
        project: { select: { userId: true } },
      },
    }),
    db.job.findFirst({
      where: {
        projectId,
        type: { in: ['gsc_sync', 'intent_classification'] },
        status: { in: ['pending', 'running'] },
      },
      select: { id: true, type: true },
    }),
    db.gscQueryData.count({ where: { projectId } }),
    db.intentProfile.count({ where: { projectId, isActive: true } }),
  ]);

  if (!connection || connection.project.userId !== session.user.id) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: connection.status === 'active',
    status: connection.status,
    propertyUrl: connection.propertyUrl,
    propertyType: connection.propertyType,
    lastSyncAt: connection.lastSyncAt?.toISOString() ?? null,
    lastSyncError: connection.lastSyncError,
    pendingJobId: pendingJob?.id ?? null,
    pendingJobType: pendingJob?.type ?? null,
    queryCount,
    profileCount,
  });
}
