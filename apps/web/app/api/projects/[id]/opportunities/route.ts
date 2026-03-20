import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db as prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: projectId } = await params;

  // Verify project ownership
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: session.user.id },
  });
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Get latest snapshot
  const snapshot = await prisma.projectScoreSnapshot.findFirst({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });

  if (!snapshot) {
    return NextResponse.json({ snapshot: null, targetQueries: [], totalFanout: 0, coveredFanout: 0 });
  }

  // Get target queries with their fanout queries for this snapshot (batchId = snapshot.id)
  const targetQueries = await prisma.targetQuery.findMany({
    where: { projectId, isActive: true },
    include: {
      fanoutQueries: {
        where: { batchId: snapshot.id },
        include: {
          coverageMap: {
            orderBy: { similarityScore: 'desc' },
            take: 1,
          },
        },
        orderBy: { generatedAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Aggregate stats
  const allFanout = targetQueries.flatMap((tq) => tq.fanoutQueries);
  const totalFanout = allFanout.length;
  const coveredFanout = allFanout.filter((fq) => fq.coverageMap[0]?.isCovered).length;

  return NextResponse.json({
    snapshot: {
      id: snapshot.id,
      createdAt: snapshot.createdAt.toISOString(),
      fanoutCoverageScore: snapshot.fanoutCoverageScore,
    },
    targetQueries: targetQueries.map((tq) => ({
      id: tq.id,
      queryText: tq.queryText,
      fanoutQueries: tq.fanoutQueries.map((fq) => ({
        id: fq.id,
        queryText: fq.queryText,
        queryType: fq.queryType,
        similarityScore: fq.coverageMap[0]?.similarityScore ?? null,
        isCovered: fq.coverageMap[0]?.isCovered ?? null,
      })),
    })),
    totalFanout,
    coveredFanout,
  });
}
