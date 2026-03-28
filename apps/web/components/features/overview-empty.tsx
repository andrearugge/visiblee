'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { FileText, Zap, Brain, Calculator } from 'lucide-react';
import { StepLoader } from '@/components/ui/step-loader';
import { SetupChecklist } from '@/components/features/setup-checklist';
import { useJobPolling } from '@/hooks/use-job-polling';

interface OverviewEmptyProps {
  projectId: string;
  hasContent: boolean;
  initialAnalysisRunning: boolean;
  initialQueryCount: number;
  initialContentCount: number;
  initialConfirmedCount: number;
  initialDiscoveryRunning: boolean;
}

const ANALYSIS_STEPS_ICONS = [FileText, Zap, Brain, Calculator];

// ── Skeleton dashboard ─────────────────────────────────────────────────────────

function SkeletonScoreRow() {
  return (
    <div className="flex items-center gap-4 py-2.5">
      <div className="h-3.5 w-28 rounded-full bg-zinc-200" />
      <div className="h-2.5 flex-1 rounded-full bg-zinc-100">
        <div className="h-2.5 w-2/5 rounded-full bg-zinc-200" />
      </div>
      <div className="h-3.5 w-8 rounded-full bg-zinc-200" />
    </div>
  );
}

function SkeletonRadar() {
  return (
    <div className="flex items-center justify-center pt-4">
      <div className="relative size-44">
        <div className="absolute inset-0 rounded-full border-2 border-zinc-100" />
        <div className="absolute inset-8 rounded-full border-2 border-zinc-100" />
        <div className="absolute inset-16 rounded-full border-2 border-zinc-100" />
        <div className="absolute inset-12 rounded-full bg-zinc-100 opacity-60" />
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="h-4 w-40 rounded-full bg-zinc-200" />
          <div className="h-3 w-56 rounded-full bg-zinc-100" />
        </div>
        <div className="h-9 w-32 rounded-lg bg-zinc-200" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
          <div className="mb-1 h-3.5 w-24 rounded-full bg-zinc-200" />
          <div className="mb-5 h-3 w-40 rounded-full bg-zinc-100" />
          <div className="divide-y divide-zinc-50">
            {[...Array(6)].map((_, i) => <SkeletonScoreRow key={i} />)}
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
          <div className="mb-1 h-3.5 w-20 rounded-full bg-zinc-200" />
          <div className="mb-5 h-3 w-36 rounded-full bg-zinc-100" />
          <SkeletonRadar />
        </div>
      </div>
      <div className="mt-4 rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
        <div className="mb-4 h-3.5 w-28 rounded-full bg-zinc-200" />
        <div className="flex h-24 items-end gap-2">
          {[40, 55, 45, 70, 60, 80, 65, 90].map((h, i) => (
            <div key={i} className="flex-1 rounded-sm bg-zinc-100" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function OverviewEmpty({
  projectId,
  initialAnalysisRunning,
  initialQueryCount,
  initialContentCount,
  initialConfirmedCount,
  initialDiscoveryRunning,
}: OverviewEmptyProps) {
  const t = useTranslations('overview');
  const DISMISS_KEY = `setup_checklist_dismissed_${projectId}`;

  const [checklistDismissed, setChecklistDismissed] = useState(false);
  const [analysisQueued, setAnalysisQueued] = useState(initialAnalysisRunning);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY)) {
      setChecklistDismissed(true);
    }
  }, [DISMISS_KEY]);

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, '1');
    setChecklistDismissed(true);
  }

  const analysisSteps = ANALYSIS_STEPS_ICONS.map((icon, i) => ({
    icon,
    label: t(`analysisStep${i + 1}` as 'analysisStep1'),
  }));

  useJobPolling({
    active: analysisQueued,
    url: `/api/projects/${projectId}/setup-status`,
    isDone: (data) => !(data as { analysisRunning: boolean }).analysisRunning,
    interval: 3500,
  });

  // Analysis running → full step loader
  if (analysisQueued) {
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

  // Skeleton dashboard + overlay
  return (
    <div className="relative min-h-[calc(100vh-3.5rem)]">
      <div className="pointer-events-none select-none opacity-30 blur-[2px]">
        <DashboardSkeleton />
      </div>
      <div className="absolute inset-0 flex items-start justify-center overflow-y-auto px-4 py-8">
        {checklistDismissed ? null : (
          <SetupChecklist
            projectId={projectId}
            initialQueryCount={initialQueryCount}
            initialContentCount={initialContentCount}
            initialConfirmedCount={initialConfirmedCount}
            initialDiscoveryRunning={initialDiscoveryRunning}
            initialAnalysisRunning={false}
            onDismiss={handleDismiss}
            onAnalysisQueued={() => setAnalysisQueued(true)}
          />
        )}
      </div>
    </div>
  );
}
