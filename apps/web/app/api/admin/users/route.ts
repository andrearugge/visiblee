import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(req: Request) {
  const session = await auth();
  if (!session || session.user.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const search = url.searchParams.get('search') ?? '';
  const role = url.searchParams.get('role') ?? '';
  const page = parseInt(url.searchParams.get('page') ?? '1');
  const limit = 20;

  const where = {
    ...(search && {
      OR: [
        { email: { contains: search, mode: 'insensitive' as const } },
        { name: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
    ...(role && { role }),
  };

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { _count: { select: { projects: true } } },
    }),
    db.user.count({ where }),
  ]);

  return NextResponse.json({ users, total, page, limit });
}
