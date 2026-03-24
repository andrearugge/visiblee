import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const projects = await db.project.findMany({
    where: { userId: session.user.id, status: { not: 'archived' } },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { targetQueries: true, contents: true } } },
  });

  return NextResponse.json(projects);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { name, brandName, websiteUrl, description, queryTargets, targetLanguage, targetCountry } = body;

  if (!name || !brandName || !websiteUrl) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const project = await db.project.create({
    data: {
      userId: session.user.id,
      name,
      brandName,
      websiteUrl,
      description,
      targetLanguage: targetLanguage || 'en',
      targetCountry: targetCountry || 'US',
    },
  });

  if (queryTargets?.length) {
    await db.targetQuery.createMany({
      data: queryTargets.map((queryText: string) => ({
        projectId: project.id,
        queryText,
      })),
    });
  }

  return NextResponse.json(project, { status: 201 });
}
