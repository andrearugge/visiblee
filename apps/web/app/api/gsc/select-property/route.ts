import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { projectId, propertyUrl } = await req.json() as {
    projectId: string;
    propertyUrl: string;
  };

  if (!projectId || !propertyUrl) {
    return NextResponse.json({ error: 'Missing projectId or propertyUrl' }, { status: 400 });
  }

  const connection = await db.gscConnection.findUnique({
    where: { projectId },
    select: { id: true, project: { select: { userId: true } } },
  });

  if (!connection || connection.project.userId !== session.user.id) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
  }

  const propertyType = propertyUrl.startsWith('sc-domain:') ? 'DOMAIN' : 'URL_PREFIX';

  await db.gscConnection.update({
    where: { projectId },
    data: { propertyUrl, propertyType },
  });

  // Trigger initial gsc_sync job
  const job = await db.job.create({
    data: {
      projectId,
      type: 'gsc_sync',
      jobChannel: 'default',
      payload: {
        projectId,
        syncType: 'initial',
        dateRange: {
          startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0],
          endDate: new Date().toISOString().split('T')[0],
        },
      },
    },
  });

  return NextResponse.json({ jobId: job.id }, { status: 201 });
}
