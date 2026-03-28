import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { action } = await req.json() as { action: 'accept' | 'dismiss' };

  if (!['accept', 'dismiss'].includes(action)) {
    return NextResponse.json({ error: 'action must be "accept" or "dismiss"' }, { status: 400 });
  }

  const suggestion = await db.gscQuerySuggestion.findUnique({
    where: { id },
    select: { id: true, query: true, projectId: true, project: { select: { userId: true } } },
  });

  if (!suggestion || suggestion.project.userId !== session.user.id) {
    return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 });
  }

  if (action === 'accept') {
    // Create target query and mark suggestion accepted — atomically
    await db.$transaction([
      db.targetQuery.create({
        data: { projectId: suggestion.projectId, queryText: suggestion.query },
      }),
      db.gscQuerySuggestion.update({
        where: { id },
        data: { status: 'accepted' },
      }),
    ]);
  } else {
    await db.gscQuerySuggestion.update({
      where: { id },
      data: { status: 'dismissed' },
    });
  }

  return NextResponse.json({ success: true });
}
