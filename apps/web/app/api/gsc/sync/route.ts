import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { projectId } = await req.json() as { projectId: string };
  if (!projectId) {
    return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
  }

  const connection = await db.gscConnection.findUnique({
    where: { projectId },
    select: {
      status: true,
      propertyUrl: true,
      project: { select: { userId: true } },
    },
  });

  if (!connection || connection.project.userId !== session.user.id) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
  }

  if (connection.status !== 'active') {
    return NextResponse.json({ error: 'Connection is not active' }, { status: 400 });
  }

  if (!connection.propertyUrl) {
    return NextResponse.json({ error: 'No property selected' }, { status: 400 });
  }

  // Prevent duplicate jobs
  const existing = await db.job.findFirst({
    where: {
      projectId,
      type: 'gsc_sync',
      status: { in: ['pending', 'running'] },
    },
    select: { id: true },
  });

  if (existing) {
    return NextResponse.json({ jobId: existing.id, alreadyRunning: true });
  }

  const job = await db.job.create({
    data: {
      projectId,
      type: 'gsc_sync',
      jobChannel: 'default',
      payload: {
        projectId,
        syncType: 'incremental',
        dateRange: {
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0],
          endDate: new Date().toISOString().split('T')[0],
        },
      },
    },
  });

  return NextResponse.json({ jobId: job.id }, { status: 201 });
}
