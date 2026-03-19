import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { BarChart3 } from 'lucide-react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { buttonVariants } from '@/lib/button-variants';
import { cn } from '@/lib/utils';
import { ConvertedBanner } from '@/components/features/converted-banner';
import { OverviewDashboard } from '@/components/features/overview-dashboard';

interface OverviewPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ converted?: string }>;
}

export default async function OverviewPage({ params, searchParams }: OverviewPageProps) {
  const [session, { id }, { converted }, t] = await Promise.all([
    auth(),
    params,
    searchParams,
    getTranslations('overview'),
  ]);

  const project = await db.project.findFirst({
    where: { id, userId: session!.user.id },
    select: { id: true },
  });
  if (!project) notFound();

  const snapshot = await db.projectScoreSnapshot.findFirst({
    where: { projectId: id },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div>
      {converted === 'true' && (
        <div className="px-6 pt-6">
          <ConvertedBanner
            title={t('convertedBannerTitle')}
            subtitle={t('convertedBannerSubtitle')}
          />
        </div>
      )}

      {snapshot ? (
        <OverviewDashboard
          projectId={id}
          snapshot={{
            aiReadinessScore: snapshot.aiReadinessScore,
            fanoutCoverageScore: snapshot.fanoutCoverageScore,
            passageQualityScore: snapshot.passageQualityScore,
            chunkabilityScore: snapshot.chunkabilityScore,
            entityCoherenceScore: snapshot.entityCoherenceScore,
            crossPlatformScore: snapshot.crossPlatformScore,
            createdAt: snapshot.createdAt.toISOString(),
          }}
        />
      ) : (
        <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50">
            <BarChart3 className="size-6 text-zinc-400" />
          </div>
          <h2 className="mb-2 text-lg font-semibold text-zinc-900">{t('emptyStateTitle')}</h2>
          <p className="mb-8 max-w-sm text-sm text-zinc-500">{t('emptyStateSubtitle')}</p>
          <Link
            href={`/app/projects/${id}/contents`}
            className={cn(buttonVariants(), 'gap-2')}
          >
            {t('emptyStateCta')}
          </Link>
        </div>
      )}
    </div>
  );
}
