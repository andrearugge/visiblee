'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { X, ArrowRight, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SetupStatus {
  queryCount: number;
  contentCount: number;
  confirmedCount: number;
  discoveryRunning: boolean;
  analysisRunning: boolean;
  hasSnapshot: boolean;
  gscConnected: boolean;
}

interface SetupBannerProps {
  projectId: string;
}

function computeProgress(status: SetupStatus, gscSkipped: boolean): { done: number; total: number } {
  const steps = [
    status.gscConnected || gscSkipped,
    status.queryCount > 0,
    status.contentCount > 0,
    status.confirmedCount > 0,
    status.hasSnapshot,
  ];
  return { done: steps.filter(Boolean).length, total: steps.length };
}

export function SetupBanner({ projectId }: SetupBannerProps) {
  const t = useTranslations('setupBanner');
  const DISMISS_KEY = `setup_banner_dismissed_${projectId}`;

  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY)) return;

    let stopped = false;

    async function check() {
      if (stopped || localStorage.getItem(DISMISS_KEY)) return;
      try {
        const r = await fetch(`/api/projects/${projectId}/setup-status`, { cache: 'no-store' });
        if (!r.ok || stopped) return;
        const data: SetupStatus = await r.json();
        const gscSkipped = !!localStorage.getItem(`gsc_skipped_${projectId}`);
        const p = computeProgress(data, gscSkipped);
        if (p.done === p.total) {
          localStorage.setItem(DISMISS_KEY, '1');
          setVisible(false);
          stopped = true;
          return;
        }
        setProgress(p);
        setVisible(true);
      } catch {
        // ignora errori di rete
      }
    }

    check();
    const interval = setInterval(check, 5000);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  }

  if (!visible || !progress) return null;

  const pct = Math.round((progress.done / progress.total) * 100);

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5">
      <div className="mx-auto flex max-w-screen-xl items-center gap-3">
        {/* Progress bar */}
        <div className="relative h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-amber-200">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-amber-500 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>

        <p className="flex-1 text-xs font-medium text-amber-800">
          {t('progress', { done: progress.done, total: progress.total })}
        </p>

        <Link
          href={`/app/projects/${projectId}/overview`}
          className={cn(
            'flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            'bg-amber-500 text-white hover:bg-amber-600',
          )}
        >
          {t('cta')}
          <ArrowRight className="size-3" />
        </Link>

        <button
          onClick={dismiss}
          className="shrink-0 rounded p-0.5 text-amber-600 transition-colors hover:bg-amber-100 hover:text-amber-800"
          aria-label={t('dismiss')}
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
