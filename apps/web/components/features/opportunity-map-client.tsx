'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronRight, Target, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFormatNumber } from '@/hooks/use-format-number';

interface FanoutQuery {
  id: string;
  queryText: string;
  queryType: string;
  similarityScore: number | null;
  isCovered: boolean | null;
}

interface TargetQuery {
  id: string;
  queryText: string;
  fanoutQueries: FanoutQuery[];
}

interface OpportunityMapClientProps {
  targetQueries: TargetQuery[];
  totalFanout: number;
  coveredFanout: number;
  snapshotCreatedAt: string;
  locale: string;
}

function CoverageChip({
  isCovered,
  similarityScore,
}: {
  isCovered: boolean | null;
  similarityScore: number | null;
}) {
  const t = useTranslations('opportunities');
  const { format } = useFormatNumber();

  if (isCovered === null || similarityScore === null) {
    return (
      <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
        —
      </span>
    );
  }

  if (isCovered) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
        <span className="size-1.5 rounded-full bg-green-500" />
        {t('covered')}
        <span className="text-green-500">· {format(Math.round(similarityScore * 100))}</span>
      </span>
    );
  }

  const isPartial = similarityScore >= 0.4;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        isPartial
          ? 'bg-amber-50 text-amber-700'
          : 'bg-red-50 text-red-700',
      )}
    >
      <span className={cn('size-1.5 rounded-full', isPartial ? 'bg-amber-400' : 'bg-red-400')} />
      {isPartial ? t('partial') : t('notCovered')}
      <span className={isPartial ? 'text-amber-500' : 'text-red-500'}>
        · {format(Math.round(similarityScore * 100))}
      </span>
    </span>
  );
}

function TargetQueryCard({ tq }: { tq: TargetQuery }) {
  const t = useTranslations('opportunities');
  const [open, setOpen] = useState(true);

  const covered = tq.fanoutQueries.filter((f) => f.isCovered).length;
  const total = tq.fanoutQueries.length;

  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-sm">
      <button
        className="flex w-full items-center gap-3 p-4 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-amber-50">
          <Target className="size-3.5 text-amber-500" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-800 truncate">{tq.queryText}</p>
          {total > 0 && (
            <p className="mt-0.5 text-xs text-zinc-400">
              {t('queriesCovered', { covered, total })}
            </p>
          )}
        </div>
        {open ? (
          <ChevronDown className="size-4 shrink-0 text-zinc-400" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-zinc-400" />
        )}
      </button>

      {open && (
        <div className="border-t border-zinc-100 p-4 pt-3">
          {tq.fanoutQueries.length === 0 ? (
            <p className="text-xs text-zinc-400 italic">{t('noFanoutForTarget')}</p>
          ) : (
            <ul className="space-y-2">
              {tq.fanoutQueries.map((fq) => (
                <li key={fq.id} className="flex items-start gap-3">
                  <CoverageChip isCovered={fq.isCovered} similarityScore={fq.similarityScore} />
                  <span className="text-sm text-zinc-600 leading-snug">{fq.queryText}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function OpportunityMapClient({
  targetQueries,
  totalFanout,
  coveredFanout,
  snapshotCreatedAt,
  locale,
}: OpportunityMapClientProps) {
  const t = useTranslations('opportunities');
  const { format } = useFormatNumber();

  const coveragePct = totalFanout > 0 ? Math.round((coveredFanout / totalFanout) * 100) : 0;
  const barColor =
    coveragePct >= 70 ? 'bg-green-500' : coveragePct >= 40 ? 'bg-amber-400' : 'bg-red-400';

  const snapshotDate = new Date(snapshotCreatedAt);
  const formattedDate =
    snapshotDate.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) +
    ', ' +
    snapshotDate.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

  const hasFanout = totalFanout > 0;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-zinc-400">
          {t('lastAnalysis')}:{' '}
          <span className="font-medium text-zinc-600">{formattedDate}</span>
        </p>
        {hasFanout && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-500">
              {t('totalCoverage')}:
            </span>
            <div className="flex items-center gap-2">
              <div className="h-2 w-24 overflow-hidden rounded-full bg-zinc-100">
                <div className={cn('h-full rounded-full', barColor)} style={{ width: `${coveragePct}%` }} />
              </div>
              <span className="text-sm font-semibold tabular-nums text-zinc-800">
                {format(coveragePct)}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* No fanout data warning */}
      {!hasFanout && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-500" />
          <div>
            <p className="text-sm font-medium text-amber-800">{t('noFanoutTitle')}</p>
            <p className="mt-0.5 text-sm text-amber-700">{t('noFanoutSubtitle')}</p>
          </div>
        </div>
      )}

      {/* Target queries */}
      <div className="space-y-3">
        {targetQueries.map((tq) => (
          <TargetQueryCard key={tq.id} tq={tq} />
        ))}
      </div>
    </div>
  );
}
