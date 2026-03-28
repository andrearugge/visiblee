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
    select: { id: true, project: { select: { userId: true } } },
  });

  if (!connection || connection.project.userId !== session.user.id) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
  }

  // Delete connection and all associated GSC data
  await db.$transaction([
    db.gscQueryData.deleteMany({ where: { projectId } }),
    db.gscQuerySuggestion.deleteMany({ where: { projectId } }),
    db.intentProfile.deleteMany({ where: { projectId } }),
    db.gscConnection.delete({ where: { projectId } }),
  ]);

  return NextResponse.json({ success: true });
}
