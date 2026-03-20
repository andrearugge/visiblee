import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function verifyProject(projectId: string, userId: string) {
  return db.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const project = await verifyProject(id, session.user.id);
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const contentType = searchParams.get('contentType') ?? undefined;
  const confirmed = searchParams.get('confirmed');

  const contents = await db.content.findMany({
    where: {
      projectId: id,
      ...(contentType ? { contentType } : {}),
      ...(confirmed !== null ? { isConfirmed: confirmed === 'true' } : {}),
    },
    select: {
      id: true,
      url: true,
      title: true,
      platform: true,
      contentType: true,
      isConfirmed: true,
      isIndexed: true,
      wordCount: true,
      discoveryConfidence: true,
      lastFetchedAt: true,
      createdAt: true,
      _count: { select: { passages: true } },
    },
    orderBy: [{ isConfirmed: 'asc' }, { discoveryConfidence: 'desc' }, { createdAt: 'desc' }],
  });

  return NextResponse.json(contents);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const project = await verifyProject(id, session.user.id);
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { url } = body;

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  try {
    const content = await db.content.create({
      data: {
        projectId: id,
        url,
        platform: 'website',
        contentType: 'own',
        source: 'manual',
        isConfirmed: true, // manually added = auto-confirmed
        discoveryConfidence: 1.0,
      },
    });
    return NextResponse.json(content, { status: 201 });
  } catch {
    // Unique constraint violation — URL already exists for this project
    return NextResponse.json({ error: 'URL already exists for this project' }, { status: 409 });
  }
}
