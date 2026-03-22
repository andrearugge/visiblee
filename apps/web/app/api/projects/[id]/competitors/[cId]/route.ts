import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; cId: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, cId } = await params;

  const project = await db.project.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const competitor = await db.competitor.findFirst({
    where: { id: cId, projectId: id },
    select: { id: true },
  });
  if (!competitor) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.competitor.delete({ where: { id: cId } });

  return NextResponse.json({});
}
