'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, CheckCircle2 } from 'lucide-react';

interface PreviewPollingProps {
  previewId: string;
}

const STEPS = ['loadingStep1', 'loadingStep2', 'loadingStep3'] as const;

export function PreviewPolling({ previewId }: PreviewPollingProps) {
  const t = useTranslations('preview');
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    // Cycle through loading steps for visual feedback
    const stepTimer = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
    }, 8000);

    // Poll every 3s
    const pollTimer = setInterval(async () => {
      try {
        const res = await fetch(`/api/preview/${previewId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === 'completed' || data.status === 'failed') {
          clearInterval(pollTimer);
          clearInterval(stepTimer);
          router.refresh();
        }
      } catch {
        // ignore network errors, keep polling
      }
    }, 3000);

    return () => {
      clearInterval(pollTimer);
      clearInterval(stepTimer);
    };
  }, [previewId, router]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      {/* Spinner */}
      <div className="relative mb-8">
        <div className="absolute inset-0 rounded-full bg-amber-100/60 blur-2xl" />
        <Loader2 className="relative size-14 animate-spin text-amber-500" />
      </div>

      <h1 className="mb-3 text-2xl font-bold text-zinc-900">{t('loadingTitle')}</h1>
      <p className="mb-10 max-w-md text-zinc-500">{t('loadingSubtitle')}</p>

      {/* Steps */}
      <div className="w-full max-w-xs space-y-3">
        {STEPS.map((step, i) => (
          <div key={step} className="flex items-center gap-3 text-sm">
            {i < stepIndex ? (
              <CheckCircle2 className="size-4 shrink-0 text-green-500" />
            ) : i === stepIndex ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-amber-500" />
            ) : (
              <div className="size-4 shrink-0 rounded-full border-2 border-zinc-200" />
            )}
            <span className={i <= stepIndex ? 'text-zinc-700' : 'text-zinc-400'}>
              {t(step)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
