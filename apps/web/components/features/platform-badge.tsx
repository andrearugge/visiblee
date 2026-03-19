import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

type Platform = 'website' | 'linkedin' | 'medium' | 'substack' | 'reddit' | 'youtube' | 'news' | 'other';

const PLATFORM_STYLES: Record<Platform, string> = {
  website: 'bg-zinc-100 text-zinc-600',
  linkedin: 'bg-blue-50 text-blue-700',
  medium: 'bg-green-50 text-green-700',
  substack: 'bg-orange-50 text-orange-700',
  reddit: 'bg-red-50 text-red-600',
  youtube: 'bg-red-50 text-red-700',
  news: 'bg-purple-50 text-purple-700',
  other: 'bg-zinc-100 text-zinc-500',
};

interface PlatformBadgeProps {
  platform: string;
  className?: string;
}

export function PlatformBadge({ platform, className }: PlatformBadgeProps) {
  const t = useTranslations('contents');
  const key = platform as Platform;
  const style = PLATFORM_STYLES[key] ?? PLATFORM_STYLES.other;

  const labelMap: Record<Platform, string> = {
    website: t('platformWebsite'),
    linkedin: t('platformLinkedin'),
    medium: t('platformMedium'),
    substack: t('platformSubstack'),
    reddit: t('platformReddit'),
    youtube: t('platformYoutube'),
    news: t('platformNews'),
    other: t('platformOther'),
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
        style,
        className,
      )}
    >
      {labelMap[key] ?? platform}
    </span>
  );
}
