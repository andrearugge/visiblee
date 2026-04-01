'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useFormatter } from 'next-intl';
import {
  CheckCircle2, XCircle, Quote, Sparkles,
  Search, ChevronDown, ChevronRight, RefreshCw, Loader2, AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useJobPolling } from '@/hooks/use-job-polling';
import { CitationRateBar } from '@/components/features/citation-rate-bar';
import { CitationVariantsPanel } from '@/components/gsc/citation-variants-panel';
import type { CitationStats } from '@/lib/citation-stats';

// ── Types ──────────────────────────────────────────────────────────────────────

interface CitedSource {
  url: string;
  title: string;
  domain: string;
  is_user: boolean;
  is_competitor: boolean;
  position: number;
  supported_text: string | null;
}

interface CitationVariant {
  profileName: string;
  profileSlug: string;
  intentProfileId: string;
  userCited: boolean;
  userCitedPosition: number | null;
}

interface CitationData {
  userCited: boolean;
  userCitedPosition: number | null;
  userCitedSegment: string | null;
  responseText: string | null;
  citedSources: CitedSource[];
  searchQueries: string[];
  checkedAt: string;
  variants: CitationVariant[];
}

interface TrendData {
  citedWeeks: number;
  totalWeeks: number;
  history: boolean[];
}

export interface QueryCitationsClientProps {
  projectId: string;
  queryId: string;
  citation: CitationData | null;
  trend: TrendData | null;
  citationStats: CitationStats | null;
  jobRunning: boolean;
}

// ── Trend dots ─────────────────────────────────────────────────────────────────

function TrendDots({ trend }: { trend: TrendData }) {
  return (
    <div className="flex items-center gap-0.5">
      {trend.history.map((cited, i) => (
        <span
          key={i}
          className={cn('inline-block size-2 rounded-full', cited ? 'bg-green-400' : 'bg-zinc-200')}
        />
      ))}
    </div>
  );
}

// ── Citation detail card ───────────────────────────────────────────────────────

function CitationDetailCard({
  citation,
  trend,
  citationStats,
  projectId,
}: {
  citation: CitationData;
  trend: TrendData;
  citationStats: CitationStats | null;
  projectId: string;
}) {
  const t = useTranslations('citations');
  const format = useFormatter();
  const [searchQueriesOpen, setSearchQueriesOpen] = useState(false);

  const checkedDate = format.dateTime(new Date(citation.checkedAt), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const totalSources = citation.citedSources.length;

  return (
    <div
      className={cn(
        'rounded-xl border p-4',
        citation.userCited ? 'border-green-100 bg-green-50/40' : 'border-red-100 bg-red-50/30',
      )}
    >
      {/* Status + trend row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {citation.userCited ? (
            <>
              <CheckCircle2 className="size-4 shrink-0 text-green-500" />
              <span className="text-sm font-semibold text-green-700">{t('cited')}</span>
              {citation.userCitedPosition != null && totalSources > 0 && (
                <span className="text-xs text-green-600">
                  — {t('position', { position: citation.userCitedPosition, total: totalSources })}
                </span>
              )}
            </>
          ) : (
            <>
              <XCircle className="size-4 shrink-0 text-red-400" />
              <span className="text-sm font-semibold text-red-600">{t('notCited')}</span>
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <TrendDots trend={trend} />
          <span className="text-xs text-zinc-400">
            {t('trend', { cited: trend.citedWeeks, total: trend.totalWeeks })}
          </span>
        </div>
      </div>

      {/* User content segment (when cited) */}
      {citation.userCited && citation.userCitedSegment && (
        <div className="mt-3 rounded-lg border border-green-200 bg-white p-3">
          <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-green-700">
            <Quote className="size-3" />
            {t('yourContentSupports')}
          </p>
          <p className="text-xs leading-relaxed text-zinc-600 italic">
            "{citation.userCitedSegment}"
          </p>
        </div>
      )}

      {/* Cited sources */}
      {totalSources > 0 && (
        <div className="mt-3">
          <p className="mb-2 text-xs font-medium text-zinc-500">
            {t('sourcesTitle', { count: totalSources })}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {citation.citedSources.map((src) => {
              const displayDomain = src.title || src.domain;
              return (
                <span
                  key={src.url}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs',
                    src.is_user
                      ? 'border-green-200 bg-green-100 font-medium text-green-800'
                      : 'border-zinc-100 bg-zinc-50 text-zinc-500',
                  )}
                >
                  <span className="tabular-nums text-zinc-300">{src.position}.</span>
                  {displayDomain}
                  {src.is_user && <span className="text-green-600">★</span>}
                  {src.is_competitor && !src.is_user && <span className="text-amber-500">⚑</span>}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Gemini internal search queries */}
      {citation.searchQueries.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setSearchQueriesOpen((v) => !v)}
            className="flex items-center gap-1 text-xs text-zinc-400 transition-colors hover:text-zinc-600"
          >
            {searchQueriesOpen ? (
              <ChevronDown className="size-3" />
            ) : (
              <ChevronRight className="size-3" />
            )}
            {t('searchQueriesToggle', { count: citation.searchQueries.length })}
          </button>
          {searchQueriesOpen && (
            <ul className="mt-1.5 space-y-1 rounded-lg bg-zinc-50 p-2">
              {citation.searchQueries.map((q, i) => (
                <li key={i} className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <Search className="size-2.5 shrink-0 text-zinc-300" />
                  {q}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Intent profile citation variants */}
      {citation.variants.length > 0 && (
        <CitationVariantsPanel variants={citation.variants} />
      )}

      {/* Bayesian citation rate bar */}
      {citationStats && citationStats.totalChecks > 0 && (
        <div className="mt-3 rounded-lg border border-zinc-100 bg-zinc-50 p-3">
          <CitationRateBar stats={citationStats} />
        </div>
      )}

      {/* Footer: date */}
      <p className="mt-3 text-xs text-zinc-400">{t('checkedAt', { date: checkedDate })}</p>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function QueryCitationsClient({
  projectId,
  queryId,
  citation,
  trend,
  citationStats,
  jobRunning,
}: QueryCitationsClientProps) {
  const t = useTranslations('citations');
  const router = useRouter();

  const [status, setStatus] = useState<'idle' | 'loading' | 'queued' | 'error'>(
    jobRunning ? 'queued' : 'idle',
  );

  useJobPolling({
    active: status === 'queued',
    url: `/api/projects/${projectId}/setup-status`,
    isDone: (data) => !(data as { analysisRunning: boolean }).analysisRunning,
    onDone: () => {
      setStatus('idle');
      router.refresh();
    },
  });

  async function handleRunCheck() {
    setStatus('loading');
    try {
      const res = await fetch(`/api/projects/${projectId}/queries/${queryId}/citation-check`, {
        method: 'POST',
      });
      if (res.ok) {
        setStatus('queued');
        router.refresh();
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header + run button */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
            <Sparkles className="size-4 text-visiblee-green-500" />
            {t('sectionTitle')}
          </h2>
          <p className="mt-0.5 text-xs text-zinc-400">{t('sectionSubtitle')}</p>
        </div>
        {status === 'error' ? (
          <div className="flex items-center gap-2 text-xs text-red-500">
            <AlertCircle className="size-3.5" />
            {t('checkError')}
          </div>
        ) : (
          <Button
            size="sm"
            onClick={handleRunCheck}
            disabled={status === 'loading' || status === 'queued'}
            className="shrink-0 gap-2"
          >
            {status === 'loading' || status === 'queued' ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            {status === 'queued' ? t('checkRunning') : t('runCheck')}
          </Button>
        )}
      </div>

      {/* Citation result */}
      {citation && trend ? (
        <CitationDetailCard
          citation={citation}
          trend={trend}
          citationStats={citationStats}
          projectId={projectId}
        />
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50">
            <Sparkles className="size-5 text-zinc-300" />
          </div>
          <p className="max-w-sm text-sm text-zinc-500">{t('emptyState')}</p>
        </div>
      )}

      {/* Stats bar (when no latest check but history exists) */}
      {!citation && citationStats && citationStats.totalChecks > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <CitationRateBar stats={citationStats} />
        </div>
      )}
    </div>
  );
}
