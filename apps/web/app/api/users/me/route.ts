import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, preferredLocale } = await req.json();

  const updated = await db.user.update({
    where: { id: session.user.id },
    data: {
      ...(name !== undefined && { name }),
      ...(preferredLocale !== undefined && { preferredLocale }),
    },
    select: { id: true, name: true, email: true, preferredLocale: true, role: true },
  });

  return NextResponse.json(updated);
}
