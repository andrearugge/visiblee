import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { websiteUrl, brandName, queryTargets } = body;

    // Basic validation
    if (!websiteUrl || !brandName || !Array.isArray(queryTargets) || queryTargets.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Capture request metadata
    const ipAddress =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
      req.headers.get('x-real-ip') ??
      null;
    const userAgent = req.headers.get('user-agent') ?? null;
    const referrer = req.headers.get('referer') ?? null;
    const locale =
      req.cookies.get('NEXT_LOCALE')?.value ??
      req.headers.get('accept-language')?.split(',')[0].split('-')[0] ??
      'en';

    const preview = await db.previewAnalysis.create({
      data: {
        websiteUrl,
        brandName,
        queryTargets,
        status: 'pending',
        ipAddress,
        userAgent,
        referrer,
        locale,
      },
    });

    await db.job.create({
      data: {
        previewId: preview.id,
        type: 'preview_analysis',
        payload: { previewId: preview.id },
      },
    });

    return NextResponse.json({ previewId: preview.id });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
