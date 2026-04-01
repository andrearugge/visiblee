'use client';

import { useTranslations } from 'next-intl';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CitationStats } from '@/lib/citation-stats';

interface CitationRateBarProps {
  stats: CitationStats;
}

export function CitationRateBar({ stats }: CitationRateBarProps) {
  const t = useTranslations('citations');

  const pct = (v: number) => `${(v * 100).toFixed(0)}%`;
  const ratePct = Math.round(stats.rate * 100);

  // Color scheme based on rate
  const isGood = stats.rate >= 0.5;
  const barColor = isGood ? 'bg-green-500' : 'bg-red-400';
  const bandColor = isGood ? 'bg-green-100' : 'bg-red-50';
  const rateTextColor = isGood ? 'text-green-700' : 'text-red-600';

  const TrendIcon =
    stats.trend === 'up' ? TrendingUp : stats.trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    stats.trend === 'up'
      ? 'text-green-500'
      : stats.trend === 'down'
        ? 'text-red-400'
        : 'text-zinc-400';

  const labelVariant = stats.label;

  return (
    <div className="space-y-1.5">
      {/* Header row: title + rate + trend */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-zinc-500">{t('rateTitle')}</span>
        <div className="flex items-center gap-2">
          <TrendIcon className={cn('size-3', trendColor)} />
          <span className={cn('text-sm font-semibold tabular-nums', rateTextColor)}>
            {ratePct}%
          </span>
          <span
            className={cn(
              'rounded-full px-1.5 py-0.5 text-xs font-medium',
              labelVariant === 'stable'
                ? 'bg-green-50 text-green-700'
                : labelVariant === 'learning'
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-zinc-100 text-zinc-500',
            )}
          >
            {t(`rateLabel.${labelVariant}`)}
          </span>
        </div>
      </div>

      {/* Bar track */}
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-zinc-100">
        {/* Confidence band */}
        <div
          className={cn('absolute inset-y-0 rounded-full', bandColor)}
          style={{
            left: pct(stats.lower),
            width: pct(stats.upper - stats.lower),
          }}
        />
        {/* Rate indicator */}
        <div
          className={cn('absolute inset-y-0 w-0.5 rounded-full', barColor)}
          style={{ left: `calc(${pct(stats.rate)} - 1px)` }}
        />
      </div>

      {/* Footer: checks count + interval */}
      <p className="text-xs text-zinc-400">
        {t('rateChecks', { count: stats.totalChecks })}
        {' · '}
        <span className="tabular-nums">
          {pct(stats.lower)}–{pct(stats.upper)}
        </span>
      </p>
    </div>
  );
}
