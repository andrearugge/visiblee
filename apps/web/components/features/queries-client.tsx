'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Search,
  Trash2,
  Plus,
  AlertCircle,
  Loader2,
  RefreshCw,
  MessageSquare,
  TriangleAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useJobPolling } from '@/hooks/use-job-polling';
import { StepLoader } from '@/components/ui/step-loader';

const QUERY_LIMIT = 15;

interface TargetQuery {
  id: string;
  queryText: string;
  isActive: boolean;
  createdAt: string;
}

interface QueriesClientProps {
  projectId: string;
  initialQueries: TargetQuery[];
  initialActiveCount: number;
  snapshotCreatedAt: string | null;
  initialAnalysisRunning: boolean;
  initialPendingChanges: boolean;
}

export function QueriesClient({
  projectId,
  initialQueries,
  initialActiveCount,
  snapshotCreatedAt,
  initialAnalysisRunning,
  initialPendingChanges,
}: QueriesClientProps) {
  const t = useTranslations('queries');
  const router = useRouter();

  const [queries, setQueries] = useState<TargetQuery[]>(initialQueries);
  const [activeCount, setActiveCount] = useState(initialActiveCount);
  const [input, setInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<'empty' | 'duplicate' | 'limit' | 'error' | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<'idle' | 'loading' | 'queued' | 'error'>(
    initialAnalysisRunning ? 'queued' : 'idle',
  );
  const [currentSnapshotCreatedAt, setCurrentSnapshotCreatedAt] = useState(snapshotCreatedAt);
  const [pendingChanges, setPendingChanges] = useState(initialPendingChanges);

  // Poll for new snapshot after analysis is queued
  useJobPolling({
    active: analysisStatus === 'queued',
    url: `/api/projects/${projectId}/snapshot/latest`,
    isDone: (data) => {
      const d = data as Record<string, unknown>;
      return !!d?.createdAt && d.createdAt !== currentSnapshotCreatedAt;
    },
    onDone: (data) => {
      const d = data as Record<string, unknown>;
      setCurrentSnapshotCreatedAt(d.createdAt as string);
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
      const newQuery: TargetQuery = await res.json();
      setQueries((prev) => [...prev, newQuery]);
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
    const res = await fetch(`/api/projects/${projectId}/queries/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setQueries((prev) =>
        prev.map((q) => (q.id === id ? { ...q, isActive: false } : q)),
      );
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

  // Show StepLoader when analysis is running
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
    <div className="p-6">
      {/* Pending changes banner */}
      {pendingChanges && (
        <div className="mb-5 flex items-start justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
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
            className="shrink-0 gap-2 bg-amber-500 text-white hover:bg-amber-600"
          >
            <RefreshCw className={cn('size-3.5', analysisStatus === 'loading' && 'animate-spin')} />
            {t('runAnalysisNow')}
          </Button>
        </div>
      )}

      <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-sm">
        {/* Card header */}
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

        {/* Query list */}
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
              <div
                key={q.id}
                className={cn(
                  'flex items-center gap-3 px-6 py-3',
                  !q.isActive && 'opacity-40',
                )}
              >
                <Search className="size-3.5 shrink-0 text-zinc-300" />
                <span className="flex-1 text-sm text-zinc-700">{q.queryText}</span>
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
            ))
          )}
        </div>

        {/* Add form */}
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

      {/* Run analysis section */}
      {activeCount > 0 && (
        <div className="mt-6 flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-5 py-4">
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
