'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations, useFormatter } from 'next-intl';
import {
  Search, Trash2, Plus, AlertCircle, Loader2, RefreshCw,
  MessageSquare, TriangleAlert, CheckCircle2, XCircle,
  ChevronDown, ChevronRight, Quote, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useJobPolling } from '@/hooks/use-job-polling';
import { StepLoader } from '@/components/ui/step-loader';
import { CitationVariantsPanel } from '@/components/gsc/citation-variants-panel';

const QUERY_LIMIT = 15;

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

interface CitationTrend {
  citedWeeks: number;
  totalWeeks: number;
  history: boolean[]; // index 0 = oldest week, last = most recent
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
  trend: CitationTrend;
  variants: CitationVariant[];
}

interface TargetQuery {
  id: string;
  queryText: string;
  isActive: boolean;
  createdAt: string;
  citation: CitationData | null;
}

interface QueriesClientProps {
  projectId: string;
  initialQueries: TargetQuery[];
  initialActiveCount: number;
  initialAnalysisRunning: boolean;
  initialPendingChanges: boolean;
}

// ── Trend dots ─────────────────────────────────────────────────────────────────

function TrendDots({ trend }: { trend: CitationTrend }) {
  return (
    <div className="flex items-center gap-0.5">
      {trend.history.map((cited, i) => (
        <span
          key={i}
          className={cn(
            'inline-block size-2 rounded-full',
            cited ? 'bg-green-400' : 'bg-zinc-200',
          )}
        />
      ))}
    </div>
  );
}

// ── Citation card ──────────────────────────────────────────────────────────────

function CitationCard({
  citation,
  projectId,
}: {
  citation: CitationData;
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
        citation.userCited
          ? 'border-green-100 bg-green-50/40'
          : 'border-red-100 bg-red-50/30',
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
          <TrendDots trend={citation.trend} />
          <span className="text-xs text-zinc-400">
            {t('trend', { cited: citation.trend.citedWeeks, total: citation.trend.totalWeeks })}
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

      {/* Cited sources — compact chip list */}
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
                  {src.is_competitor && !src.is_user && (
                    <span className="text-amber-500">⚑</span>
                  )}
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

      {/* Footer: date + CTA */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-xs text-zinc-400">{t('checkedAt', { date: checkedDate })}</p>
        {!citation.userCited ? (
          <Link
            href={`/app/projects/${projectId}/competitors`}
            className="text-xs text-zinc-500 transition-colors hover:text-zinc-800"
          >
            {t('seeCompetitors')}
          </Link>
        ) : (
          <Link
            href={`/app/projects/${projectId}/optimization`}
            className="text-xs text-zinc-500 transition-colors hover:text-zinc-800"
          >
            {t('howToRankHigher')}
          </Link>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function QueriesClient({
  projectId,
  initialQueries,
  initialActiveCount,
  initialAnalysisRunning,
  initialPendingChanges,
}: QueriesClientProps) {
  const t = useTranslations('queries');
  const tc = useTranslations('citations');
  const router = useRouter();

  const [queries, setQueries] = useState<TargetQuery[]>(initialQueries);
  const [activeCount, setActiveCount] = useState(initialActiveCount);
  const [input, setInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<'empty' | 'duplicate' | 'limit' | 'error' | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<'idle' | 'loading' | 'queued' | 'error'>(
    initialAnalysisRunning ? 'queued' : 'idle',
  );
  const [pendingChanges, setPendingChanges] = useState(initialPendingChanges);
  const [expandedCitations, setExpandedCitations] = useState<Set<string>>(new Set());

  const hasCitationData = queries.some((q) => q.isActive && q.citation !== null);

  useJobPolling({
    active: analysisStatus === 'queued',
    url: `/api/projects/${projectId}/setup-status`,
    isDone: (data) => !(data as { analysisRunning: boolean }).analysisRunning,
    onDone: () => {
      setAnalysisStatus('idle');
      setPendingChanges(false);
      router.refresh();
    },
  });

  async function handleAdd() {
    const text = input.trim();
    if (!text) { setAddError('empty'); return; }
    if (activeCount >= QUERY_LIMIT) { setAddError('limit'); return; }

    setAdding(true);
    setAddError(null);

    const res = await fetch(`/api/projects/${projectId}/queries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queryText: text }),
    });

    if (res.ok) {
      const newQuery = await res.json();
      setQueries((prev) => [...prev, { ...newQuery, citation: null }]);
      setActiveCount((n) => n + 1);
      setInput('');
      setPendingChanges(true);
    } else {
      const body = await res.json().catch(() => ({}));
      if (body.error === 'duplicate') setAddError('duplicate');
      else if (body.error === 'limit_reached') setAddError('limit');
      else setAddError('error');
    }
    setAdding(false);
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/projects/${projectId}/queries/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setQueries((prev) => prev.map((q) => (q.id === id ? { ...q, isActive: false } : q)));
      setActiveCount((n) => n - 1);
      setPendingChanges(true);
    }
  }

  async function handleRunAnalysis() {
    setAnalysisStatus('loading');
    try {
      const res = await fetch(`/api/projects/${projectId}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'full_analysis' }),
      });
      if (res.ok) {
        setAnalysisStatus('queued');
        router.refresh();
      } else {
        setAnalysisStatus('error');
      }
    } catch {
      setAnalysisStatus('error');
    }
  }

  function toggleCitation(queryId: string) {
    setExpandedCitations((prev) => {
      const next = new Set(prev);
      if (next.has(queryId)) next.delete(queryId);
      else next.add(queryId);
      return next;
    });
  }

  if (analysisStatus === 'queued') {
    return (
      <div className="p-6">
        <StepLoader
          title={t('runAnalysis')}
          subtitle={t('analysisPolling')}
          steps={[
            { icon: Search, label: t('runAnalysis') },
            { icon: MessageSquare, label: t('analysisPolling') },
            { icon: RefreshCw, label: t('analysisPolling') },
          ]}
          skeleton="score-rows"
        />
      </div>
    );
  }

  const atLimit = activeCount >= QUERY_LIMIT;

  return (
    <div className="p-6 space-y-6">
      {/* Pending changes banner */}
      {pendingChanges && (
        <div className="flex items-start justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <div className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <div>
              <p className="text-sm font-semibold text-amber-800">{t('pendingChangesTitle')}</p>
              <p className="mt-0.5 text-xs text-amber-600">{t('pendingChangesSubtitle')}</p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={handleRunAnalysis}
            disabled={analysisStatus === 'loading'}
            className="shrink-0 gap-2 bg-visiblee-green-500 text-white hover:bg-visiblee-green-600"
          >
            <RefreshCw className={cn('size-3.5', analysisStatus === 'loading' && 'animate-spin')} />
            {t('runAnalysisNow')}
          </Button>
        </div>
      )}

      {/* Query list card */}
      <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">{t('title')}</h2>
            <p className="mt-0.5 text-xs text-zinc-400">{t('subtitle')}</p>
          </div>
          <span
            className={cn(
              'rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums',
              activeCount >= QUERY_LIMIT
                ? 'bg-red-50 text-red-600'
                : activeCount >= 12
                  ? 'bg-amber-50 text-amber-600'
                  : 'bg-zinc-100 text-zinc-500',
            )}
          >
            {t('limitBadge', { count: activeCount, limit: QUERY_LIMIT })}
          </span>
        </div>

        <div className="divide-y divide-zinc-50">
          {queries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex size-12 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50">
                <Search className="size-5 text-zinc-400" />
              </div>
              <p className="mb-1 text-sm font-semibold text-zinc-700">{t('emptyTitle')}</p>
              <p className="max-w-xs text-xs text-zinc-400">{t('emptySubtitle')}</p>
            </div>
          ) : (
            queries.map((q) => (
              <div key={q.id} className={cn(!q.isActive && 'opacity-40')}>
                <div className="flex items-center gap-3 px-6 py-3">
                  <Search className="size-3.5 shrink-0 text-zinc-300" />
                  <span className="flex-1 text-sm text-zinc-700">{q.queryText}</span>
                  {/* Citation badge (when data exists) */}
                  {q.isActive && q.citation && (
                    <button
                      onClick={() => toggleCitation(q.id)}
                      className={cn(
                        'flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors',
                        q.citation.userCited
                          ? 'bg-green-50 text-green-700 hover:bg-green-100'
                          : 'bg-red-50 text-red-600 hover:bg-red-100',
                      )}
                    >
                      {q.citation.userCited ? (
                        <CheckCircle2 className="size-3" />
                      ) : (
                        <XCircle className="size-3" />
                      )}
                      {q.citation.userCited ? tc('cited') : tc('notCited')}
                      {expandedCitations.has(q.id) ? (
                        <ChevronDown className="size-3" />
                      ) : (
                        <ChevronRight className="size-3" />
                      )}
                    </button>
                  )}
                  {!q.isActive && (
                    <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-400">
                      {t('inactive')}
                    </span>
                  )}
                  {q.isActive && (
                    <button
                      onClick={() => handleDelete(q.id)}
                      aria-label={t('deleteAriaLabel')}
                      className="text-zinc-300 transition-colors hover:text-red-400"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
                {/* Expandable citation card */}
                {q.isActive && q.citation && expandedCitations.has(q.id) && (
                  <div className="px-6 pb-4">
                    <CitationCard citation={q.citation} projectId={projectId} />
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="border-t border-zinc-100 px-6 py-4">
          {atLimit ? (
            <p className="text-xs text-red-500">{t('limitReached')}</p>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                type="text"
                placeholder={t('addPlaceholder')}
                value={input}
                onChange={(e) => { setInput(e.target.value); setAddError(null); }}
                onKeyDown={(e) => e.key === 'Enter' && !adding && handleAdd()}
                className="h-8 flex-1 text-sm"
                disabled={adding}
              />
              <Button
                size="sm"
                onClick={handleAdd}
                disabled={adding || !input.trim()}
                className="h-8 gap-1.5"
              >
                {adding ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                {t('add')}
              </Button>
            </div>
          )}
          {addError === 'duplicate' && (
            <p className="mt-1.5 text-xs text-amber-600">{t('duplicateError')}</p>
          )}
          {addError === 'error' && (
            <p className="mt-1.5 flex items-center gap-1 text-xs text-red-500">
              <AlertCircle className="size-3" />
              {t('analysisError')}
            </p>
          )}
        </div>
      </div>

      {/* Citation simulation section */}
      <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-visiblee-green-500" />
            <h2 className="text-sm font-semibold text-zinc-900">{tc('sectionTitle')}</h2>
          </div>
          <p className="mt-0.5 text-xs text-zinc-400">{tc('sectionSubtitle')}</p>
        </div>

        {!hasCitationData ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-6">
            <div className="mb-4 flex size-12 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50">
              <Sparkles className="size-5 text-zinc-300" />
            </div>
            <p className="max-w-sm text-sm text-zinc-500">{tc('emptyState')}</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-50">
            {queries
              .filter((q) => q.isActive && q.citation)
              .map((q) => (
                <div key={q.id} className="p-4">
                  <p className="mb-3 flex items-center gap-2 text-xs font-medium text-zinc-500">
                    <Search className="size-3 text-zinc-300" />
                    {q.queryText}
                  </p>
                  <CitationCard citation={q.citation!} projectId={projectId} />
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Run analysis footer */}
      {activeCount > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-5 py-4">
          <div>
            <p className="text-sm font-medium text-zinc-700">{t('runAnalysis')}</p>
            <p className="mt-0.5 text-xs text-zinc-400">{t('runAnalysisHint')}</p>
          </div>
          {analysisStatus === 'error' ? (
            <div className="flex items-center gap-2 text-xs text-red-500">
              <AlertCircle className="size-3.5" />
              {t('analysisError')}
            </div>
          ) : (
            <Button
              size="sm"
              onClick={handleRunAnalysis}
              disabled={analysisStatus === 'loading'}
              className="gap-2"
            >
              <RefreshCw className={cn('size-3.5', analysisStatus === 'loading' && 'animate-spin')} />
              {t('runAnalysis')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
