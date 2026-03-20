'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { BarChart3, RefreshCw, FileText, Zap, Brain, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StepLoader } from '@/components/ui/step-loader';
import { useJobPolling } from '@/hooks/use-job-polling';

interface OverviewEmptyProps {
  projectId: string;
  hasContent: boolean;
  initialAnalysisRunning: boolean;
}

const ANALYSIS_STEPS_ICONS = [FileText, Zap, Brain, Calculator];

export function OverviewEmpty({ projectId, hasContent, initialAnalysisRunning }: OverviewEmptyProps) {
  const t = useTranslations('overview');
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'loading' | 'queued' | 'error'>(
    initialAnalysisRunning ? 'queued' : 'idle',
  );

  useJobPolling({
    active: status === 'queued',
    url: `/api/projects/${projectId}/snapshot/latest`,
    isDone: (data) => (data as Record<string, unknown>)?.aiReadinessScore !== undefined,
  });

  async function handleRunAnalysis() {
    setStatus('loading');
    try {
      const res = await fetch(`/api/projects/${projectId}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'full_analysis' }),
      });
      if (res.ok) {
        setStatus('queued');
        router.refresh(); // bust Router Cache so navigating away and back shows the loader
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }

  const analysisSteps = ANALYSIS_STEPS_ICONS.map((icon, i) => ({
    icon,
    label: t(`analysisStep${i + 1}` as 'analysisStep1'),
  }));

  // ── Analysis in progress ───────────────────────────────────────────────────
  if (status === 'queued') {
    return (
      <StepLoader
        title={t('analysisRunningTitle')}
        subtitle={t('analysisRunningSubtitle')}
        steps={analysisSteps}
        pollingText={t('analysisPolling')}
        skeleton="score-rows"
      />
    );
  }

  // ── No confirmed content yet ───────────────────────────────────────────────
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
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
        >
          <FileText className="size-4" />
          {t('emptyStateCta')}
        </Link>
      </div>
    );
  }

  // ── Has content, ready to run first analysis ───────────────────────────────
  return (
    <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50">
        <BarChart3 className="size-6 text-zinc-400" />
      </div>
      <h2 className="mb-2 text-lg font-semibold text-zinc-900">{t('readyToAnalyzeTitle')}</h2>
      <p className="mb-8 max-w-sm text-sm text-zinc-500">{t('readyToAnalyzeSubtitle')}</p>
      <div className="flex items-center gap-3">
        <Button onClick={handleRunAnalysis} disabled={status === 'loading'} className="gap-2">
          <RefreshCw className={status === 'loading' ? 'size-4 animate-spin' : 'size-4'} />
          {status === 'loading' ? t('runAnalysisLoading') : t('runAnalysis')}
        </Button>
        {status === 'error' && <p className="text-sm text-red-500">{t('runAnalysisError')}</p>}
      </div>
    </div>
  );
}
