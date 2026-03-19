import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

const ALLOWED_TYPES = ['full_analysis', 'discovery'] as const;
type JobType = (typeof ALLOWED_TYPES)[number];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const project = await db.project.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const type: JobType = body.type;

  if (!ALLOWED_TYPES.includes(type)) {
    return NextResponse.json({ error: 'Invalid job type' }, { status: 400 });
  }

  const job = await db.job.create({
    data: { projectId: id, type, payload: { projectId: id } },
  });

  return NextResponse.json({ jobId: job.id }, { status: 201 });
}
