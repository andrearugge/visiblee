import { getTranslations } from 'next-intl/server';
import { PlaceholderPage } from '@/components/onboarding/placeholder-page';
import { ConvertedBanner } from '@/components/features/converted-banner';

interface OverviewPageProps {
  searchParams: Promise<{ converted?: string }>;
}

export default async function OverviewPage({ searchParams }: OverviewPageProps) {
  const [{ converted }, t] = await Promise.all([searchParams, getTranslations('overview')]);

  return (
    <div className="space-y-4">
      {converted === 'true' && (
        <ConvertedBanner
          title={t('convertedBannerTitle')}
          subtitle={t('convertedBannerSubtitle')}
        />
      )}
      <PlaceholderPage pageName="Overview" />
    </div>
  );
}
