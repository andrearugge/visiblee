import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

const VALID_STATUSES = ['pending', 'in_progress', 'completed', 'dismissed'];

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; rId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: projectId, rId } = await params;
  const body = await req.json();
  const { status } = body as { status: string };

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  // Verify ownership via project
  const rec = await db.recommendation.findFirst({
    where: { id: rId, projectId, project: { userId: session.user.id } },
    select: { id: true },
  });
  if (!rec) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updated = await db.recommendation.update({
    where: { id: rId },
    data: { status },
    select: { id: true, status: true },
  });

  return NextResponse.json(updated);
}
