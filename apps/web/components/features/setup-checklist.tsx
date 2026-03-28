'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Check, Lock, ArrowRight, Loader2, X,
  Search, FileText, BarChart3, Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface SetupChecklistProps {
  projectId: string;
  initialQueryCount: number;
  initialContentCount: number;
  initialConfirmedCount: number;
  initialDiscoveryRunning: boolean;
  initialAnalysisRunning: boolean;
  onDismiss: () => void;
  onAnalysisQueued?: () => void;
}

type StepStatus = 'done' | 'active' | 'locked';

interface SetupStatusData {
  queryCount: number;
  contentCount: number;
  confirmedCount: number;
  discoveryRunning: boolean;
  analysisRunning: boolean;
}

// ── Step indicator icon ────────────────────────────────────────────────────────

function StepIndicator({ status, index }: { status: StepStatus; index: number }) {
  if (status === 'done') {
    return (
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-visiblee-green-100">
        <Check className="size-4 text-visiblee-green-600" strokeWidth={2.5} />
      </div>
    );
  }
  if (status === 'active') {
    return (
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white">
        {index + 1}
      </div>
    );
  }
  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50">
      <Lock className="size-3.5 text-zinc-300" />
    </div>
  );
}

// ── Step icon (contextual) ─────────────────────────────────────────────────────

const STEP_ICONS = [Search, Globe, FileText, BarChart3];

// ── Step row wrapper ───────────────────────────────────────────────────────────

function StepRow({
  status,
  index,
  title,
  doneLabel,
  lockedLabel,
  children,
}: {
  status: StepStatus;
  index: number;
  title: string;
  doneLabel?: string;
  lockedLabel?: string;
  children?: React.ReactNode;
}) {
  const StepIcon = STEP_ICONS[index];

  return (
    <div
      className={cn(
        'rounded-xl border p-4 transition-all duration-200',
        status === 'done' && 'border-visiblee-green-100 bg-visiblee-green-50/50',
        status === 'active' && 'border-zinc-200 bg-white shadow-sm',
        status === 'locked' && 'border-zinc-100 bg-zinc-50/40',
      )}
    >
      <div className="flex items-start gap-3">
        <StepIndicator status={status} index={index} />
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-center justify-between gap-2">
            <p
              className={cn(
                'text-sm font-semibold',
                status === 'done' && 'text-zinc-500',
                status === 'active' && 'text-zinc-900',
                status === 'locked' && 'text-zinc-400',
              )}
            >
              <StepIcon
                className={cn(
                  'mr-1.5 inline size-3.5 -mt-px',
                  status === 'done' && 'text-visiblee-green-500',
                  status === 'active' && 'text-zinc-500',
                  status === 'locked' && 'text-zinc-300',
                )}
              />
              {title}
            </p>
            {status === 'done' && doneLabel && (
              <span className="shrink-0 text-xs font-medium text-visiblee-green-600">{doneLabel}</span>
            )}
          </div>
          {status === 'locked' && lockedLabel && (
            <p className="mt-0.5 text-xs text-zinc-400">{lockedLabel}</p>
          )}
        </div>
      </div>

      {status === 'active' && children && (
        <div className="mt-3 ml-11">{children}</div>
      )}
    </div>
  );
}

// ── Step 1: Add queries inline (multi-line textarea) ──────────────────────────

function AddQueryAction({
  projectId,
  queryCount,
  onQueryAdded,
}: {
  projectId: string;
  queryCount: number;
  onQueryAdded: (count: number) => void;
}) {
  const t = useTranslations('setup');
  const [input, setInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addedCount, setAddedCount] = useState(0);

  async function handleAdd() {
    const lines = input.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length || adding) return;
    setAdding(true);
    setError(null);
    let successCount = 0;
    for (const text of lines) {
      try {
        const res = await fetch(`/api/projects/${projectId}/queries`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ queryText: text }),
        });
        if (res.ok) successCount++;
      } catch {
        // continue with remaining lines
      }
    }
    setAdding(false);
    if (successCount > 0) {
      setInput('');
      setAddedCount((c) => c + successCount);
      onQueryAdded(successCount);
    } else {
      setError(t('step1AddError'));
    }
  }

  const lineCount = input.split('\n').filter((l) => l.trim()).length;
  const totalAdded = queryCount + addedCount;

  return (
    <div className="space-y-2.5">
      <p className="text-xs leading-relaxed text-zinc-500">{t('step1Description')}</p>
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={t('step1Placeholder')}
        rows={3}
        disabled={adding}
        className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs leading-relaxed text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none disabled:opacity-50"
      />
      <div className="flex items-center justify-between gap-2">
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={adding || !lineCount}
          className="h-8 gap-1.5 text-xs"
        >
          {adding && <Loader2 className="size-3 animate-spin" />}
          {lineCount > 1 ? t('step1AddMultiple', { count: lineCount }) : t('step1Add')}
        </Button>
        {totalAdded > 0 && (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs font-medium text-green-600">
              <Check className="size-3" strokeWidth={2.5} />
              {t('step1Done', { count: totalAdded })}
            </span>
            <Link
              href={`/app/projects/${projectId}/queries`}
              className="flex items-center gap-0.5 text-xs text-zinc-400 transition-colors hover:text-zinc-700"
            >
              {t('step1ViewAll')}
              <ArrowRight className="size-3" />
            </Link>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ── Step 2: Discovery ──────────────────────────────────────────────────────────

function DiscoveryAction({
  projectId,
  discoveryStatus,
  onStart,
  error,
}: {
  projectId: string;
  discoveryStatus: 'idle' | 'starting' | 'running';
  onStart: () => void;
  error: string | null;
}) {
  const t = useTranslations('setup');

  return (
    <div className="space-y-2.5">
      <p className="text-xs leading-relaxed text-zinc-500">{t('step2Description')}</p>
      {discoveryStatus === 'running' ? (
        <div className="flex items-center gap-2 text-xs font-medium text-zinc-600">
          <Loader2 className="size-3.5 animate-spin text-visiblee-green-500" />
          {t('step2Running')}
        </div>
      ) : (
        <Button
          size="sm"
          onClick={onStart}
          disabled={discoveryStatus === 'starting'}
          className="h-8 gap-1.5 text-xs"
        >
          {discoveryStatus === 'starting' && <Loader2 className="size-3 animate-spin" />}
          {t('step2Cta')}
        </Button>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ── Step 3: Confirm contents ───────────────────────────────────────────────────

function ConfirmAction({ projectId }: { projectId: string }) {
  const t = useTranslations('setup');
  return (
    <div className="space-y-2.5">
      <p className="text-xs leading-relaxed text-zinc-500">{t('step3Description')}</p>
      <Link
        href={`/app/projects/${projectId}/contents`}
        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-zinc-900 px-3 text-xs font-medium text-white transition-colors hover:bg-zinc-700"
      >
        {t('step3Cta')}
        <ArrowRight className="size-3" />
      </Link>
    </div>
  );
}

// ── Step 4: Run analysis ───────────────────────────────────────────────────────

function AnalysisAction({
  analysisStatus,
  onStart,
  error,
}: {
  analysisStatus: 'idle' | 'starting' | 'running';
  onStart: () => void;
  error: string | null;
}) {
  const t = useTranslations('setup');

  return (
    <div className="space-y-2.5">
      <p className="text-xs leading-relaxed text-zinc-500">{t('step4Description')}</p>
      {analysisStatus === 'running' ? (
        <div className="flex items-center gap-2 text-xs font-medium text-zinc-600">
          <Loader2 className="size-3.5 animate-spin text-visiblee-green-500" />
          {t('step4Running')}
        </div>
      ) : (
        <Button
          size="sm"
          onClick={onStart}
          disabled={analysisStatus === 'starting'}
          className="h-8 gap-1.5 bg-visiblee-green-500 text-xs text-white hover:bg-visiblee-green-600"
        >
          {analysisStatus === 'starting' && <Loader2 className="size-3 animate-spin" />}
          <BarChart3 className="size-3" />
          {t('step4Cta')}
        </Button>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function SetupChecklist({
  projectId,
  initialQueryCount,
  initialContentCount,
  initialConfirmedCount,
  initialDiscoveryRunning,
  initialAnalysisRunning,
  onDismiss,
  onAnalysisQueued,
}: SetupChecklistProps) {
  const t = useTranslations('setup');
  const router = useRouter();

  const [queryCount, setQueryCount] = useState(initialQueryCount);
  const [contentCount, setContentCount] = useState(initialContentCount);
  const [confirmedCount, setConfirmedCount] = useState(initialConfirmedCount);
  const [discoveryStatus, setDiscoveryStatus] = useState<'idle' | 'starting' | 'running'>(
    initialDiscoveryRunning ? 'running' : 'idle',
  );
  const [analysisStatus, setAnalysisStatus] = useState<'idle' | 'starting' | 'running'>(
    initialAnalysisRunning ? 'running' : 'idle',
  );
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // ── Poll setup-status while jobs are running ────────────────────────────────
  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/setup-status`);
      if (!res.ok) return;
      const data: SetupStatusData = await res.json();

      setQueryCount(data.queryCount);
      setContentCount(data.contentCount);
      setConfirmedCount(data.confirmedCount);

      if (discoveryStatus === 'running' && !data.discoveryRunning) {
        setDiscoveryStatus('idle');
      }
      if (analysisStatus === 'running' && !data.analysisRunning) {
        // Job finished — refresh to check if snapshot was created
        router.refresh();
      }
    } catch {
      // silently ignore poll errors
    }
  }, [projectId, discoveryStatus, analysisStatus, router]);

  useEffect(() => {
    if (discoveryStatus !== 'running' && analysisStatus !== 'running') return;
    const interval = setInterval(pollStatus, 3500);
    return () => clearInterval(interval);
  }, [discoveryStatus, analysisStatus, pollStatus]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  async function handleStartDiscovery() {
    setDiscoveryError(null);
    setDiscoveryStatus('starting');
    try {
      const res = await fetch(`/api/projects/${projectId}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'discovery' }),
      });
      if (res.ok) {
        setDiscoveryStatus('running');
        router.refresh();
      } else {
        setDiscoveryStatus('idle');
        setDiscoveryError(t('step2StartError'));
      }
    } catch {
      setDiscoveryStatus('idle');
      setDiscoveryError(t('step2StartError'));
    }
  }

  async function handleRunAnalysis() {
    setAnalysisError(null);
    setAnalysisStatus('starting');
    try {
      const res = await fetch(`/api/projects/${projectId}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'full_analysis' }),
      });
      if (res.ok) {
        setAnalysisStatus('running');
        onAnalysisQueued?.();
        router.refresh();
      } else {
        setAnalysisStatus('idle');
        setAnalysisError(t('step4StartError'));
      }
    } catch {
      setAnalysisStatus('idle');
      setAnalysisError(t('step4StartError'));
    }
  }

  // ── Derive step statuses ─────────────────────────────────────────────────────

  const s1: StepStatus = queryCount > 0 ? 'done' : 'active';
  const s2: StepStatus = contentCount > 0 ? 'done' : 'active';
  const s3: StepStatus = confirmedCount > 0 ? 'done' : contentCount === 0 ? 'locked' : 'active';
  const s4: StepStatus = confirmedCount === 0 ? 'locked' : 'active';

  const doneCount = [s1, s2, s3, s4].filter((s) => s === 'done').length;
  const progress = doneCount / 4;

  return (
    <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white shadow-2xl shadow-zinc-200/60 backdrop-blur-sm">
      {/* Header */}
      <div className="border-b border-zinc-100 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-semibold text-zinc-900">{t('title')}</p>
            <p className="mt-0.5 text-xs text-zinc-500">{t('subtitle')}</p>
            <p className="mt-0.5 text-xs text-zinc-500">{t('progress', { done: doneCount, total: 4 })}</p>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-2 p-4">
        {/* Step 1 — Add queries */}
        <StepRow
          status={s1}
          index={0}
          title={t('step1Title')}
          doneLabel={t('step1Done', { count: queryCount })}
        >
          <AddQueryAction
            projectId={projectId}
            queryCount={queryCount}
            onQueryAdded={(n) => setQueryCount((c) => c + n)}
          />
        </StepRow>

        {/* Step 2 — Discovery */}
        <StepRow
          status={s2}
          index={1}
          title={t('step2Title')}
          doneLabel={t('step2Done', { count: contentCount })}
        >
          <DiscoveryAction
            projectId={projectId}
            discoveryStatus={discoveryStatus}
            onStart={handleStartDiscovery}
            error={discoveryError}
          />
        </StepRow>

        {/* Step 3 — Confirm */}
        <StepRow
          status={s3}
          index={2}
          title={t('step3Title')}
          doneLabel={t('step3Done', { count: confirmedCount })}
          lockedLabel={t('step3Locked')}
        >
          <ConfirmAction projectId={projectId} />
        </StepRow>

        {/* Step 4 — Analysis */}
        <StepRow
          status={s4}
          index={3}
          title={t('step4Title')}
          lockedLabel={t('step4Locked')}
        >
          <AnalysisAction
            analysisStatus={analysisStatus}
            onStart={handleRunAnalysis}
            error={analysisError}
          />
        </StepRow>
      </div>

    </div>
  );
}
