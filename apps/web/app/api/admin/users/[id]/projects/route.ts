import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const projects = await db.project.findMany({
    where: { userId: id },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(projects);
}
