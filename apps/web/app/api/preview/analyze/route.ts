import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { websiteUrl, brandName, queryTargets, locale: bodyLocale } = body;

    // Validate URL
    try {
      const url = new URL(websiteUrl);
      if (!['http:', 'https:'].includes(url.protocol)) {
        return NextResponse.json({ error: 'Invalid URL protocol' }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    // Validate brandName
    if (!brandName || typeof brandName !== 'string' || !brandName.trim()) {
      return NextResponse.json({ error: 'Brand name is required' }, { status: 400 });
    }

    // Validate queryTargets: array, 1–5 non-empty strings
    if (!Array.isArray(queryTargets)) {
      return NextResponse.json({ error: 'queryTargets must be an array' }, { status: 400 });
    }
    const cleanedQueries = queryTargets
      .map((q: unknown) => (typeof q === 'string' ? q.trim() : ''))
      .filter(Boolean);

    if (cleanedQueries.length === 0) {
      return NextResponse.json({ error: 'At least one query is required' }, { status: 400 });
    }
    if (cleanedQueries.length > 5) {
      return NextResponse.json({ error: 'Maximum 5 queries allowed' }, { status: 400 });
    }

    // Capture request metadata
    const ipAddress =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
      req.headers.get('x-real-ip') ??
      null;
    const userAgent = req.headers.get('user-agent') ?? null;
    const referrer = req.headers.get('referer') ?? null;
    const locale =
      bodyLocale ??
      req.cookies.get('NEXT_LOCALE')?.value ??
      req.headers.get('accept-language')?.split(',')[0].split('-')[0] ??
      'en';

    const preview = await db.previewAnalysis.create({
      data: {
        websiteUrl: websiteUrl.trim(),
        brandName: brandName.trim(),
        queryTargets: cleanedQueries,
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
