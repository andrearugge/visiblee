import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

const QUERY_LIMIT = 15;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const project = await db.project.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const queries = await db.targetQuery.findMany({
    where: { projectId: id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, queryText: true, isActive: true, createdAt: true },
  });

  const activeCount = queries.filter((q) => q.isActive).length;

  return NextResponse.json({ queries, activeCount, limit: QUERY_LIMIT });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const project = await db.project.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { queryText }: { queryText: string } = await req.json();

  if (!queryText?.trim()) {
    return NextResponse.json({ error: 'queryText required' }, { status: 400 });
  }

  // Check limit
  const activeCount = await db.targetQuery.count({
    where: { projectId: id, isActive: true },
  });
  if (activeCount >= QUERY_LIMIT) {
    return NextResponse.json({ error: 'limit_reached' }, { status: 400 });
  }

  // Check duplicate (case-insensitive among active)
  const existing = await db.targetQuery.findFirst({
    where: { projectId: id, isActive: true, queryText: { equals: queryText.trim(), mode: 'insensitive' } },
  });
  if (existing) {
    return NextResponse.json({ error: 'duplicate' }, { status: 400 });
  }

  const query = await db.targetQuery.create({
    data: { projectId: id, queryText: queryText.trim() },
    select: { id: true, queryText: true, isActive: true, createdAt: true },
  });

  return NextResponse.json(query, { status: 201 });
}
