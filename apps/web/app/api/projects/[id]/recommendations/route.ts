import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: projectId } = await params;

  const project = await db.project.findFirst({
    where: { id: projectId, userId: session.user.id },
    select: { id: true },
  });
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const recommendations = await db.recommendation.findMany({
    where: { projectId },
    orderBy: [
      { priority: 'asc' }, // high < low alphabetically — handled client-side
      { createdAt: 'desc' },
    ],
    select: {
      id: true,
      type: true,
      priority: true,
      effort: true,
      title: true,
      description: true,
      suggestedAction: true,
      targetScore: true,
      status: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ recommendations });
}
