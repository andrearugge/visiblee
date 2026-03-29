'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { HelpCircle, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useJobPolling } from '@/hooks/use-job-polling';
import { useFormatNumber } from '@/hooks/use-format-number';
import { ScoreRadarChart } from './score-radar-chart';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface Snapshot {
  aiReadinessScore: number;
  fanoutCoverageScore: number;
  citationPowerScore: number;
  extractabilityScore: number;
  entityAuthorityScore: number;
  sourceAuthorityScore: number;
  createdAt: string;
}

interface OverviewDashboardProps {
  projectId: string;
  initialAnalysisRunning: boolean;
  snapshot: Snapshot;
}

function ScoreBar({ value, className }: { value: number; className?: string }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400';
  const { format } = useFormatNumber();
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 shrink-0 text-right text-sm font-semibold tabular-nums text-zinc-800">
        {format(pct)}
      </span>
    </div>
  );
}

interface ScoreRowProps {
  label: string;
  description: string;
  value: number;
}

function ScoreRow({ label, description, value }: ScoreRowProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-36 shrink-0 text-sm font-medium text-zinc-700">{label}</span>
      <ScoreBar value={value} className="flex-1" />
      <TooltipProvider delay={200}>
        <Tooltip>
          <TooltipTrigger render={<button suppressHydrationWarning className="text-zinc-300 hover:text-zinc-500 transition-colors" />}>
            <HelpCircle className="size-3.5" />
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-56 text-xs">
            {description}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

function RunAnalysisButton({
  projectId,
  initialRunning,
}: {
  projectId: string;
  initialRunning: boolean;
}) {
  const t = useTranslations('overview');
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'loading' | 'queued' | 'error'>(
    initialRunning ? 'queued' : 'idle',
  );

  // Poll job status directly — avoids race condition where snapshot is already the new one
  useJobPolling({
    active: status === 'queued',
    url: `/api/projects/${projectId}/setup-status`,
    isDone: (data) => !(data as { analysisRunning: boolean }).analysisRunning,
    onDone: () => {
      setStatus('idle');
      router.refresh();
    },
  });

  async function handleClick() {
    setStatus('loading');
    try {
      const res = await fetch(`/api/projects/${projectId}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'full_analysis' }),
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

  if (status === 'queued') {
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Loader2 className="size-4 animate-spin" />
        {t('analysisPolling')}
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex items-center gap-2 text-sm text-red-500">
        <AlertCircle className="size-4" />
        {t('runAnalysisError')}
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={status === 'loading'}
      className="gap-2"
    >
      <RefreshCw className={cn('size-3.5', status === 'loading' && 'animate-spin')} />
      {t('reRunAnalysis')}
    </Button>
  );
}

export function OverviewDashboard({ projectId, initialAnalysisRunning, snapshot }: OverviewDashboardProps) {
  const t = useTranslations('overview');
  const ts = useTranslations('scores');
  const { format } = useFormatNumber();
  const locale = useLocale();

  const aiScore = Math.round(snapshot.aiReadinessScore * 100);

  const scoreRows = [
    {
      key: 'queryReach',
      label: ts('queryReach.label'),
      description: ts('queryReach.description'),
      value: snapshot.fanoutCoverageScore,
    },
    {
      key: 'citationPower',
      label: ts('citationPower.label'),
      description: ts('citationPower.description'),
      value: snapshot.citationPowerScore,
    },
    {
      key: 'extractability',
      label: ts('extractability.label'),
      description: ts('extractability.description'),
      value: snapshot.extractabilityScore,
    },
    {
      key: 'brandAuthority',
      label: ts('brandAuthority.label'),
      description: ts('brandAuthority.description'),
      value: snapshot.entityAuthorityScore,
    },
    {
      key: 'sourceAuthority',
      label: ts('sourceAuthority.label'),
      description: ts('sourceAuthority.description'),
      value: snapshot.sourceAuthorityScore,
    },
  ];

  const snapshotDate = new Date(snapshot.createdAt);
  const formattedDateTime = snapshotDate.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }) + ', ' + snapshotDate.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-zinc-400">{t('lastUpdated')}: <span className="font-medium text-zinc-600">{formattedDateTime}</span></p>
        <div className="flex items-center gap-3">
          <RunAnalysisButton
            projectId={projectId}
            initialRunning={initialAnalysisRunning}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left column */}
        <div className="space-y-6">
          {/* Main score */}
          <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 text-center shadow-sm">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              {ts('aiReadiness')}
            </p>
            <div className="my-4 flex items-end justify-center gap-1">
              <span className="text-7xl font-bold leading-none tracking-tight text-zinc-900">
                {format(aiScore)}
              </span>
              <span className="mb-2 text-2xl font-medium text-zinc-300">/ 100</span>
            </div>
            <div className="mx-auto mt-2 h-2 max-w-[180px] overflow-hidden rounded-full bg-zinc-100">
              <div
                className={cn(
                  'h-full rounded-full',
                  aiScore >= 70 ? 'bg-green-500' : aiScore >= 40 ? 'bg-amber-400' : 'bg-red-400',
                )}
                style={{ width: `${aiScore}%` }}
              />
            </div>
          </div>

          {/* Radar chart */}
          <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm">
            <ScoreRadarChart
              scores={{
                queryReach: snapshot.fanoutCoverageScore,
                citationPower: snapshot.citationPowerScore,
                extractability: snapshot.extractabilityScore,
                brandAuthority: snapshot.entityAuthorityScore,
                sourceAuthority: snapshot.sourceAuthorityScore,
              }}
            />
          </div>
        </div>

        {/* Right column — sub-scores */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            {t('scoreBreakdown')}
          </h2>
          <div className="space-y-5">
            {scoreRows.map((row) => (
              <ScoreRow
                key={row.key}
                label={row.label}
                description={row.description}
                value={row.value}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
