import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

async function verifyContent(contentId: string, projectId: string, userId: string) {
  return db.content.findFirst({
    where: {
      id: contentId,
      projectId,
      project: { userId },
    },
    select: { id: true },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; cId: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, cId } = await params;
  const content = await verifyContent(cId, id, session.user.id);
  if (!content) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { isConfirmed } = body;

  if (typeof isConfirmed !== 'boolean') {
    return NextResponse.json({ error: 'isConfirmed must be a boolean' }, { status: 400 });
  }

  const updated = await db.content.update({
    where: { id: cId },
    data: { isConfirmed },
    select: { id: true, isConfirmed: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; cId: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, cId } = await params;
  const content = await verifyContent(cId, id, session.user.id);
  if (!content) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.content.delete({ where: { id: cId } });
  return NextResponse.json({ success: true });
}
