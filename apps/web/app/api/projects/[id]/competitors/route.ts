import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const project = await db.project.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const competitors = await db.competitor.findMany({
    where: { projectId: id },
    orderBy: { createdAt: 'asc' },
    include: {
      contents: { select: { id: true } },
    },
  });

  const result = competitors.map((c) => ({
    id: c.id,
    name: c.name,
    websiteUrl: c.websiteUrl,
    isConfirmed: c.isConfirmed,
    avgPassageScore: c.avgPassageScore,
    contentCount: c.contents.length,
    createdAt: c.createdAt.toISOString(),
  }));

  return NextResponse.json(result);
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

  const { name, websiteUrl }: { name: string; websiteUrl: string } = await req.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: 'name_required' }, { status: 400 });
  }
  if (!websiteUrl?.trim()) {
    return NextResponse.json({ error: 'url_required' }, { status: 400 });
  }

  // Validate URL format
  try {
    new URL(websiteUrl.trim());
  } catch {
    return NextResponse.json({ error: 'invalid_url' }, { status: 400 });
  }

  const competitor = await db.competitor.create({
    data: {
      projectId: id,
      name: name.trim(),
      websiteUrl: websiteUrl.trim(),
      source: 'manual',
    },
    select: {
      id: true,
      name: true,
      websiteUrl: true,
      isConfirmed: true,
      createdAt: true,
    },
  });

  return NextResponse.json(
    { ...competitor, createdAt: competitor.createdAt.toISOString(), contentCount: 0 },
    { status: 201 },
  );
}
