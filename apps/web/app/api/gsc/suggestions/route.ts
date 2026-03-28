import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const projectId = req.nextUrl.searchParams.get('projectId');
  if (!projectId) {
    return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
  }

  const project = await db.project.findFirst({
    where: { id: projectId, userId: session.user.id },
    select: { id: true },
  });
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const suggestions = await db.gscQuerySuggestion.findMany({
    where: { projectId, status: 'pending' },
    orderBy: { impressions: 'desc' },
    select: {
      id: true,
      query: true,
      reason: true,
      intentType: true,
      impressions: true,
      clicks: true,
      avgPosition: true,
      similarityScore: true,
    },
  });

  return NextResponse.json({ suggestions });
}
