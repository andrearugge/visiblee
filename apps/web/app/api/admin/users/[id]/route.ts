import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

async function requireSuperadmin() {
  const session = await auth();
  if (!session || session.user.role !== 'superadmin') return null;
  return session;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireSuperadmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const user = await db.user.findUnique({
    where: { id },
    include: { _count: { select: { projects: true } } },
  });

  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(user);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireSuperadmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const { role } = await req.json();

  const updated = await db.user.update({
    where: { id },
    data: { role },
  });

  return NextResponse.json(updated);
}
