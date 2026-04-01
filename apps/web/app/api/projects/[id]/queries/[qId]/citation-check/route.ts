import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * POST /api/projects/[id]/queries/[qId]/citation-check
 *
 * Creates a citation_check job scoped to a single target query.
 */
export async function POST(
  _req: Request,
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

  const targetQuery = await db.targetQuery.findFirst({
    where: { id: qId, projectId: id, isActive: true },
    select: { id: true },
  });
  if (!targetQuery) return NextResponse.json({ error: 'Query not found' }, { status: 404 });

  const job = await db.job.create({
    data: {
      projectId: id,
      type: 'citation_check',
      payload: { targetQueryId: qId },
    },
  });

  return NextResponse.json({ jobId: job.id }, { status: 201 });
}
