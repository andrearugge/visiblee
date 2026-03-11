import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const preview = await db.previewAnalysis.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      websiteUrl: true,
      brandName: true,
      queryTargets: true,
      aiReadinessScore: true,
      fanoutCoverageScore: true,
      passageQualityScore: true,
      chunkabilityScore: true,
      entityCoherenceScore: true,
      crossPlatformScore: true,
      insights: true,
      contentsFound: true,
      createdAt: true,
      expiresAt: true,
    },
  });

  if (!preview) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (preview.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Preview expired' }, { status: 404 });
  }

  return NextResponse.json(preview);
}
