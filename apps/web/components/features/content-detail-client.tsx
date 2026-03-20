'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronUp, ExternalLink, FileText, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFormatNumber } from '@/hooks/use-format-number';
import { PlatformBadge } from './platform-badge';

interface PassageScore {
  overallScore: number | null;
  selfContainedness: number | null;
  claimClarity: number | null;
  informationDensity: number | null;
  completeness: number | null;
  verifiability: number | null;
  llmReasoning: string | null;
}

interface Passage {
  id: string;
  passageText: string;
  passageIndex: number;
  wordCount: number | null;
  heading: string | null;
  passageScores: PassageScore[];
}

interface ContentData {
  id: string;
  url: string;
  title: string | null;
  platform: string;
  contentType: string;
  wordCount: number | null;
  lastFetchedAt: string | null;
  createdAt: string;
  passages: Passage[];
}

// ─── Score bar ─────────────────────────────────────────────────────────────────

function ScoreBar({ value, size = 'md' }: { value: number; size?: 'sm' | 'md' }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className={cn('flex items-center gap-2', size === 'sm' ? 'gap-1.5' : 'gap-2')}>
      <div className={cn('flex-1 overflow-hidden rounded-full bg-zinc-100', size === 'sm' ? 'h-1.5' : 'h-2')}>
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn('shrink-0 tabular-nums font-semibold text-zinc-800', size === 'sm' ? 'w-6 text-xs' : 'w-7 text-sm')}>
        {pct}
      </span>
    </div>
  );
}

// ─── Sub-criterion row ─────────────────────────────────────────────────────────

const CRITERIA: { key: keyof PassageScore; weight: string }[] = [
  { key: 'selfContainedness', weight: '25%' },
  { key: 'claimClarity', weight: '20%' },
  { key: 'informationDensity', weight: '20%' },
  { key: 'completeness', weight: '20%' },
  { key: 'verifiability', weight: '15%' },
];

function CriteriaRow({ criterionKey, value, weight }: { criterionKey: string; value: number | null; weight: string }) {
  const t = useTranslations('contentDetail');
  return (
    <div className="flex items-center gap-3">
      <span className="w-44 shrink-0 text-xs text-zinc-500">
        {t(criterionKey as 'selfContainedness')}
        <span className="ml-1 text-zinc-300">({weight})</span>
      </span>
      {value !== null ? (
        <ScoreBar value={value} size="sm" />
      ) : (
        <span className="text-xs text-zinc-300">—</span>
      )}
    </div>
  );
}

// ─── Passage card ──────────────────────────────────────────────────────────────

function PassageCard({ passage, index, hasScores }: { passage: Passage; index: number; hasScores: boolean }) {
  const t = useTranslations('contentDetail');
  const { format } = useFormatNumber();
  const [expanded, setExpanded] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);

  const score = passage.passageScores[0] ?? null;
  const overallPct = score?.overallScore != null ? Math.round(score.overallScore * 100) : null;
  const scoreColor =
    overallPct == null ? 'text-zinc-300' :
    overallPct >= 70 ? 'text-green-600' :
    overallPct >= 40 ? 'text-amber-500' :
    'text-red-500';

  // Truncate long passages
  const MAX_CHARS = 300;
  const isLong = passage.passageText.length > MAX_CHARS;
  const displayText = isLong && !expanded
    ? passage.passageText.slice(0, MAX_CHARS) + '…'
    : passage.passageText;

  return (
    <div className="rounded-xl border border-zinc-200/80 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-zinc-100">
        <div className="flex items-center gap-2 min-w-0">
          {passage.heading ? (
            <span className="truncate text-sm font-medium text-zinc-700">{passage.heading}</span>
          ) : (
            <span className="text-sm text-zinc-400">{t('passageN', { n: index + 1 })}</span>
          )}
          {passage.wordCount ? (
            <span className="shrink-0 text-xs text-zinc-400">· {format(passage.wordCount)} {t('words')}</span>
          ) : null}
        </div>
        {/* Score badge */}
        {hasScores && (
          <div className={cn('shrink-0 text-lg font-bold tabular-nums', scoreColor)}>
            {overallPct != null ? overallPct : '—'}
          </div>
        )}
      </div>

      {/* Passage text */}
      <div className="px-5 py-4">
        <p className="text-sm leading-relaxed text-zinc-600 whitespace-pre-wrap">{displayText}</p>
        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-1.5 flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            {expanded ? t('collapse') : t('expand')}
          </button>
        )}
      </div>

      {/* Sub-criteria (only if scores exist) */}
      {hasScores && score && (
        <div className="border-t border-zinc-100 px-5 py-4 space-y-2">
          {CRITERIA.map(({ key, weight }) => (
            <CriteriaRow
              key={key}
              criterionKey={key}
              value={score[key] as number | null}
              weight={weight}
            />
          ))}

          {score.llmReasoning && (
            <div className="mt-3">
              <button
                onClick={() => setShowReasoning(!showReasoning)}
                className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                <MessageSquare className="size-3" />
                {showReasoning ? t('hideReasoning') : t('showReasoning')}
              </button>
              {showReasoning && (
                <p className="mt-2 rounded-lg bg-zinc-50 px-3 py-2 text-xs leading-relaxed text-zinc-500 border border-zinc-100">
                  {score.llmReasoning}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function ContentDetailClient({ data, projectId }: { data: ContentData; projectId: string }) {
  const t = useTranslations('contentDetail');
  const { format } = useFormatNumber();

  const hasPassages = data.passages.length > 0;
  const hasScores = data.passages.some((p) => p.passageScores.length > 0);

  const displayUrl = (() => {
    try { const u = new URL(data.url); return u.hostname + u.pathname; }
    catch { return data.url; }
  })();

  const lastFetched = data.lastFetchedAt
    ? new Date(data.lastFetchedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      {/* Back link */}
      <Link
        href={`/app/projects/${projectId}/contents`}
        className="text-sm text-zinc-500 hover:text-zinc-700 transition-colors"
      >
        {t('backToContents')}
      </Link>

      {/* Content header card */}
      <div className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <PlatformBadge platform={data.platform} />
            <h1 className="truncate text-base font-semibold text-zinc-900">
              {data.title ?? displayUrl}
            </h1>
          </div>
          <a
            href={data.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center rounded-md border border-zinc-200 p-1.5 text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            <ExternalLink className="size-3.5" />
          </a>
        </div>

        <p className="text-xs text-zinc-400 truncate">{displayUrl}</p>

        <div className="flex items-center gap-4 text-xs text-zinc-400">
          {data.wordCount ? (
            <span className="flex items-center gap-1">
              <FileText className="size-3" />
              {format(data.wordCount)} {t('words')}
            </span>
          ) : null}
          {hasPassages ? (
            <span>{format(data.passages.length)} {t('passages')}</span>
          ) : null}
          <span>
            {lastFetched ? `${t('lastFetched')}: ${lastFetched}` : t('notFetched')}
          </span>
        </div>
      </div>

      {/* Passages */}
      {!hasPassages ? (
        <div className="rounded-xl border border-dashed border-zinc-200 py-16 text-center">
          <FileText className="mx-auto mb-3 size-8 text-zinc-300" />
          <p className="text-sm text-zinc-400">{t('noPassages')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {!hasScores && (
            <p className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {t('noScores')}
            </p>
          )}
          {data.passages.map((passage, i) => (
            <PassageCard key={passage.id} passage={passage} index={i} hasScores={hasScores} />
          ))}
        </div>
      )}
    </div>
  );
}
