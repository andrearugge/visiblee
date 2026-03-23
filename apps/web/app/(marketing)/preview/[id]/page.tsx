import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { db } from '@/lib/db';
import { PreviewPolling } from '@/components/features/preview-polling';
import { PreviewResults } from '@/components/features/preview-results';

interface PreviewPageProps {
  params: Promise<{ id: string }>;
}

export default async function PreviewPage({ params }: PreviewPageProps) {
  const { id } = await params;
  const t = await getTranslations('preview');

  const preview = await db.previewAnalysis.findUnique({
    where: { id },
  });

  // Not found or expired
  if (!preview || (preview.expiresAt && preview.expiresAt < new Date())) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <h1 className="mb-2 text-2xl font-bold text-zinc-900">{t('errorTitle')}</h1>
        <p className="mb-6 max-w-md text-zinc-500">{t('errorSubtitle')}</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          <ArrowLeft className="size-4" />
          {t('errorCta')}
        </Link>
      </div>
    );
  }

  // Analysis failed
  if (preview.status === 'failed') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <h1 className="mb-2 text-2xl font-bold text-zinc-900">{t('failedTitle')}</h1>
        <p className="mb-6 max-w-md text-zinc-500">{t('failedSubtitle')}</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          <ArrowLeft className="size-4" />
          {t('failedCta')}
        </Link>
      </div>
    );
  }

  // Still processing
  if (preview.status === 'pending' || preview.status === 'processing') {
    return <PreviewPolling previewId={id} />;
  }

  // Completed — show results
  return (
    <PreviewResults
      data={{
        id: preview.id,
        websiteUrl: preview.websiteUrl,
        brandName: preview.brandName,
        aiReadinessScore: preview.aiReadinessScore ?? 0,
        fanoutCoverageScore: preview.fanoutCoverageScore ?? 0,
        citationPowerScore: preview.citationPowerScore ?? 0,
        extractabilityScore: preview.extractabilityScore ?? 0,
        entityAuthorityScore: preview.entityAuthorityScore ?? 0,
        sourceAuthorityScore: preview.sourceAuthorityScore ?? 0,
        insights: (preview.insights as string[]) ?? [],
        contentsFound: preview.contentsFound ?? 0,
      }}
    />
  );
}
