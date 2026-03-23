import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

// competitor_analysis is intentionally excluded — use /competitors/[cId]/analyze route which injects competitorId
const ALLOWED_TYPES = ['full_analysis', 'discovery', 'fetch_content'] as const;
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
  const { type, contentId }: { type: JobType; contentId?: string } = body;

  if (!ALLOWED_TYPES.includes(type)) {
    return NextResponse.json({ error: 'Invalid job type' }, { status: 400 });
  }

  // For fetch_content jobs, verify the content belongs to this project
  if (type === 'fetch_content') {
    if (!contentId) return NextResponse.json({ error: 'contentId required' }, { status: 400 });
    const content = await db.content.findFirst({
      where: { id: contentId, projectId: id },
      select: { id: true },
    });
    if (!content) return NextResponse.json({ error: 'Content not found' }, { status: 404 });
  }

  const payload = type === 'fetch_content'
    ? { contentId }
    : { projectId: id };

  const job = await db.job.create({
    data: { projectId: id, type, payload },
  });

  return NextResponse.json({ jobId: job.id }, { status: 201 });
}
