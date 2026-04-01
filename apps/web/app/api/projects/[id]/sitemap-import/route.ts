import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * GET /api/projects/[id]/sitemap-import
 * Restituisce { running: boolean } — usato per il polling del job.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const project = await db.project.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const active = await db.job.findFirst({
    where: { projectId: id, type: 'sitemap_import', status: { in: ['pending', 'running'] } },
    select: { id: true },
  });

  return NextResponse.json({ running: !!active });
}

/**
 * POST /api/projects/[id]/sitemap-import
 *
 * Crea un job `sitemap_import` per il progetto.
 * Il worker scarica sitemap.xml, estrae gli URL e li inserisce come contenuti
 * auto-confermati (source: 'sitemap', isConfirmed: true).
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const project = await db.project.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, websiteUrl: true },
  });
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!project.websiteUrl) {
    return NextResponse.json({ error: 'Project has no website URL' }, { status: 422 });
  }

  // Evita job duplicati
  const existing = await db.job.findFirst({
    where: { projectId: id, type: 'sitemap_import', status: { in: ['pending', 'running'] } },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ jobId: existing.id, alreadyRunning: true }, { status: 200 });
  }

  const job = await db.job.create({
    data: { projectId: id, type: 'sitemap_import', payload: { projectId: id } },
  });

  return NextResponse.json({ jobId: job.id }, { status: 201 });
}
