'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { BarChart3, RefreshCw, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OverviewEmptyProps {
  projectId: string;
  hasContent: boolean;
  initialAnalysisRunning: boolean;
}

const POLL_INTERVAL = 5000;

export function OverviewEmpty({ projectId, hasContent, initialAnalysisRunning }: OverviewEmptyProps) {
  const t = useTranslations('overview');
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'loading' | 'queued' | 'error'>(
    initialAnalysisRunning ? 'queued' : 'idle',
  );

  // Poll for snapshot while analysis is running
  useEffect(() => {
    if (status !== 'queued') return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/snapshot/latest`);
        if (!res.ok) return;
        const data = await res.json();
        if (data?.aiReadinessScore !== undefined) {
          // Snapshot ready — refresh the server component
          router.refresh();
        }
      } catch {
        // keep polling
      }
    };

    const id = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [status, projectId, router]);

  async function handleRunAnalysis() {
    setStatus('loading');
    try {
      const res = await fetch(`/api/projects/${projectId}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'full_analysis' }),
      });
      setStatus(res.ok ? 'queued' : 'error');
    } catch {
      setStatus('error');
    }
  }

  // ── Analysis in progress ──────────────────────────────────────────────────
  if (status === 'queued') {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
        <div className="relative mb-8 flex size-20 items-center justify-center">
          <div className="absolute inset-0 animate-ping rounded-full bg-zinc-100" />
          <div className="absolute inset-2 animate-pulse rounded-full bg-zinc-100" />
          <div className="relative flex size-14 items-center justify-center rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <BarChart3 className="size-6 text-zinc-400" />
          </div>
        </div>
        <h2 className="mb-2 text-lg font-semibold text-zinc-900">{t('analysisRunningTitle')}</h2>
        <p className="mb-4 max-w-sm text-sm text-zinc-500">{t('analysisRunningSubtitle')}</p>
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Loader2 className="size-4 animate-spin" />
          {t('analysisPolling')}
        </div>
      </div>
    );
  }

  // ── No confirmed+fetched content yet ─────────────────────────────────────
  if (!hasContent) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50">
          <BarChart3 className="size-6 text-zinc-400" />
        </div>
        <h2 className="mb-2 text-lg font-semibold text-zinc-900">{t('emptyStateTitle')}</h2>
        <p className="mb-8 max-w-sm text-sm text-zinc-500">{t('emptyStateSubtitle')}</p>
        <Link
          href={`/app/projects/${projectId}/contents`}
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition-colors"
        >
          <FileText className="size-4" />
          {t('emptyStateCta')}
        </Link>
      </div>
    );
  }

  // ── Has content, ready to run first analysis ──────────────────────────────
  return (
    <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50">
        <BarChart3 className="size-6 text-zinc-400" />
      </div>
      <h2 className="mb-2 text-lg font-semibold text-zinc-900">{t('readyToAnalyzeTitle')}</h2>
      <p className="mb-8 max-w-sm text-sm text-zinc-500">{t('readyToAnalyzeSubtitle')}</p>
      <div className="flex items-center gap-3">
        <Button
          onClick={handleRunAnalysis}
          disabled={status === 'loading'}
          className="gap-2"
        >
          <RefreshCw className={status === 'loading' ? 'size-4 animate-spin' : 'size-4'} />
          {status === 'loading' ? t('runAnalysisLoading') : t('runAnalysis')}
        </Button>
        {status === 'error' && (
          <p className="text-sm text-red-500">{t('runAnalysisError')}</p>
        )}
      </div>
    </div>
  );
}
