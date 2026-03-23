'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronRight, Target, AlertCircle, Info } from 'lucide-react';
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

// ── Coverage chip ──────────────────────────────────────────────────────────────

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
      <span className="inline-flex shrink-0 items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
        —
      </span>
    );
  }

  if (isCovered) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
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
        'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        isPartial ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700',
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

// ── Legend ─────────────────────────────────────────────────────────────────────

function Legend() {
  const t = useTranslations('opportunities');
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-6">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-zinc-400 transition-colors hover:text-zinc-600"
      >
        <Info className="size-3.5" />
        {t('legendTitle')}
        {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
      </button>
      {open && (
        <div className="mt-2 space-y-2 rounded-xl border border-zinc-100 bg-zinc-50 p-3">
          {(
            [
              { key: 'legendCovered', dot: 'bg-green-500', text: 'text-green-700' },
              { key: 'legendPartial', dot: 'bg-amber-400', text: 'text-amber-700' },
              { key: 'legendGap', dot: 'bg-red-400', text: 'text-red-700' },
            ] as const
          ).map(({ key, dot, text }) => (
            <div key={key} className="flex items-start gap-2">
              <span className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', dot)} />
              <p className="text-xs leading-relaxed text-zinc-600">
                <span className={cn('font-medium', text)}>
                  {key === 'legendCovered' ? t('covered') : key === 'legendPartial' ? t('partial') : t('notCovered')}
                  {' — '}
                </span>
                {t(key)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Coverage stat card ─────────────────────────────────────────────────────────

function CoverageStatCard({
  coveragePct,
  coveredFanout,
  totalFanout,
}: {
  coveragePct: number;
  coveredFanout: number;
  totalFanout: number;
}) {
  const t = useTranslations('opportunities');
  const { format } = useFormatNumber();

  const barColor =
    coveragePct >= 70 ? 'bg-green-500' : coveragePct >= 40 ? 'bg-amber-400' : 'bg-red-400';
  const textColor =
    coveragePct >= 70 ? 'text-green-600' : coveragePct >= 40 ? 'text-amber-600' : 'text-red-500';

  const gapCount = totalFanout - coveredFanout;

  return (
    <div className="mb-6 rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-5">
        <div className="shrink-0 text-center">
          <p className={cn('text-4xl font-bold tabular-nums', textColor)}>
            {format(coveragePct)}%
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">{t('totalCoverage')}</p>
        </div>
        <div className="flex-1 pt-1">
          <p className="text-sm leading-relaxed text-zinc-600">
            {t('totalCoverageDetail')}
          </p>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-zinc-100">
            <div
              className={cn('h-full rounded-full transition-all duration-500', barColor)}
              style={{ width: `${coveragePct}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-zinc-400">
            <span>{format(coveredFanout)} covered</span>
            {gapCount > 0 && (
              <span className="font-medium text-red-500">
                {gapCount === 1 ? t('gapCount', { count: gapCount }) : t('gapCountPlural', { count: gapCount })}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Target query card ──────────────────────────────────────────────────────────

function TargetQueryCard({ tq, gapsFirst }: { tq: TargetQuery; gapsFirst: boolean }) {
  const t = useTranslations('opportunities');
  const [open, setOpen] = useState(true);

  const covered = tq.fanoutQueries.filter((f) => f.isCovered).length;
  const total = tq.fanoutQueries.length;
  const gapCount = tq.fanoutQueries.filter(
    (f) => f.isCovered === false && (f.similarityScore ?? 0) < 0.4,
  ).length;

  // Sort: gaps → partial → covered (when gapsFirst enabled)
  const sortedFanout = gapsFirst
    ? [...tq.fanoutQueries].sort((a, b) => {
        const rank = (f: FanoutQuery) => {
          if (f.isCovered) return 2;
          if ((f.similarityScore ?? 0) >= 0.4) return 1;
          return 0;
        };
        return rank(a) - rank(b);
      })
    : tq.fanoutQueries;

  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-sm">
      <button
        className="flex w-full items-center gap-3 p-4 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-amber-50">
          <Target className="size-3.5 text-amber-500" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-zinc-800">{tq.queryText}</p>
          {total > 0 && (
            <div className="mt-0.5 flex items-center gap-2">
              <p className="text-xs text-zinc-400">{t('queriesCovered', { covered, total })}</p>
              {gapCount > 0 && (
                <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-600">
                  {gapCount === 1 ? t('gapCount', { count: gapCount }) : t('gapCountPlural', { count: gapCount })}
                </span>
              )}
            </div>
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
            <p className="text-xs italic text-zinc-400">{t('noFanoutForTarget')}</p>
          ) : (
            <ul className="space-y-2.5">
              {sortedFanout.map((fq) => {
                const isGap = fq.isCovered === false && (fq.similarityScore ?? 0) < 0.4;
                return (
                  <li key={fq.id} className={cn('flex items-start gap-3', isGap && 'rounded-lg bg-red-50/50 px-2 py-1.5 -mx-2')}>
                    <CoverageChip isCovered={fq.isCovered} similarityScore={fq.similarityScore} />
                    <div className="min-w-0">
                      <span className="text-sm leading-snug text-zinc-600">{fq.queryText}</span>
                      {isGap && (
                        <p className="mt-0.5 text-xs text-red-400">{t('gapActionHint')}</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function OpportunityMapClient({
  targetQueries,
  totalFanout,
  coveredFanout,
  snapshotCreatedAt,
  locale,
}: OpportunityMapClientProps) {
  const t = useTranslations('opportunities');
  const [gapsFirst, setGapsFirst] = useState(true);

  const coveragePct = totalFanout > 0 ? Math.round((coveredFanout / totalFanout) * 100) : 0;

  const snapshotDate = new Date(snapshotCreatedAt);
  const formattedDate =
    snapshotDate.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) +
    ', ' +
    snapshotDate.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

  const hasFanout = totalFanout > 0;

  return (
    <div className="p-6">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-zinc-900">{t('pageTitle')}</h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-zinc-500">{t('pageSubtitle')}</p>
        <p className="mt-2 text-xs text-zinc-400">
          {t('lastAnalysis')}:{' '}
          <span className="font-medium text-zinc-500">{formattedDate}</span>
        </p>
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

      {/* Coverage stat card */}
      {hasFanout && (
        <CoverageStatCard
          coveragePct={coveragePct}
          coveredFanout={coveredFanout}
          totalFanout={totalFanout}
        />
      )}

      {/* Legend (collapsible) */}
      <Legend />

      {/* Sort toggle */}
      {hasFanout && (
        <div className="mb-4 flex items-center justify-end">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-500">
            <span>{t('sortLabel')}</span>
            <button
              role="switch"
              aria-checked={gapsFirst}
              onClick={() => setGapsFirst((v) => !v)}
              className={cn(
                'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                gapsFirst ? 'bg-zinc-900' : 'bg-zinc-200',
              )}
            >
              <span
                className={cn(
                  'inline-block size-3.5 rounded-full bg-white shadow transition-transform',
                  gapsFirst ? 'translate-x-4' : 'translate-x-0.5',
                )}
              />
            </button>
          </label>
        </div>
      )}

      {/* Target queries */}
      <div className="space-y-3">
        {targetQueries.map((tq) => (
          <TargetQueryCard key={tq.id} tq={tq} gapsFirst={gapsFirst} />
        ))}
      </div>
    </div>
  );
}
