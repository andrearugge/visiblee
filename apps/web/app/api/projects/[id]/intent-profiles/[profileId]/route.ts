import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// DELETE /api/projects/[id]/intent-profiles/[profileId] — delete a manual intent profile
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; profileId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId, profileId } = await params;

  const project = await db.project.findFirst({
    where: { id: projectId, userId: session.user.id },
    select: { id: true },
  });
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const profile = await db.intentProfile.findFirst({
    where: { id: profileId, projectId },
    select: { id: true, source: true },
  });
  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }
  if (profile.source !== 'manual') {
    return NextResponse.json({ error: 'Only manual profiles can be deleted' }, { status: 403 });
  }

  await db.intentProfile.delete({ where: { id: profileId } });

  return NextResponse.json({ ok: true });
}
