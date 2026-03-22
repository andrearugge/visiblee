import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; qId: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, qId } = await params;

  const project = await db.project.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const query = await db.targetQuery.findFirst({
    where: { id: qId, projectId: id },
    select: { id: true },
  });
  if (!query) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Deactivate rather than delete to preserve fanout history
  await db.targetQuery.update({
    where: { id: qId },
    data: { isActive: false },
  });

  return NextResponse.json({});
}
