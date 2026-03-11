import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const { email } = body;

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
  }

  const preview = await db.previewAnalysis.findUnique({
    where: { id },
    select: { id: true, expiresAt: true, status: true },
  });

  if (!preview || preview.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await db.previewAnalysis.update({
    where: { id },
    data: { reportEmail: email.trim() },
  });

  await db.job.create({
    data: {
      previewId: id,
      type: 'send_preview_report',
      payload: { previewId: id, email: email.trim() },
    },
  });

  return NextResponse.json({ success: true });
}
