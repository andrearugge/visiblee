'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Brain, BarChart2, Search, Map, ChevronRight, ChevronLeft, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OnboardingWizardProps {
  projectId: string;
}

const STEPS = ['step1', 'step2', 'step3', 'step4'] as const;
const TOTAL = STEPS.length;

function StepIcon({ step, size = 'md' }: { step: number; size?: 'sm' | 'md' }) {
  const cls = size === 'sm' ? 'size-4' : 'size-8';
  const icons = [
    <Brain key={0} className={cls} />,
    <BarChart2 key={1} className={cls} />,
    <Search key={2} className={cls} />,
    <Map key={3} className={cls} />,
  ];
  return icons[step] ?? null;
}

function Step1({ t }: { t: ReturnType<typeof useTranslations<'onboarding'>> }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-amber-50">
        <Brain className="size-8 text-amber-500" />
      </div>
      <h2 className="mb-3 text-xl font-bold text-zinc-900">{t('step1Title')}</h2>
      <p className="mb-4 text-sm leading-relaxed text-zinc-500">{t('step1Description')}</p>
      <div className="rounded-xl bg-zinc-50 px-4 py-3 text-left">
        <p className="text-sm text-zinc-600">{t('step1Detail')}</p>
      </div>
    </div>
  );
}

function Step2({ t }: { t: ReturnType<typeof useTranslations<'onboarding'>> }) {
  const dims = [
    t('step2Dim1'),
    t('step2Dim2'),
    t('step2Dim3'),
    t('step2Dim4'),
    t('step2Dim5'),
  ];
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-blue-50">
        <BarChart2 className="size-8 text-blue-500" />
      </div>
      <h2 className="mb-3 text-xl font-bold text-zinc-900">{t('step2Title')}</h2>
      <p className="mb-4 text-sm leading-relaxed text-zinc-500">{t('step2Description')}</p>
      <ul className="w-full space-y-2 text-left">
        {dims.map((dim, i) => (
          <li key={i} className="flex items-start gap-2 rounded-xl bg-zinc-50 px-3 py-2">
            <span className="mt-0.5 shrink-0 text-xs font-bold text-zinc-400">{i + 1}</span>
            <span className="text-sm text-zinc-600">{dim}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Step3({ t }: { t: ReturnType<typeof useTranslations<'onboarding'>> }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-green-50">
        <Search className="size-8 text-green-500" />
      </div>
      <h2 className="mb-3 text-xl font-bold text-zinc-900">{t('step3Title')}</h2>
      <p className="mb-4 text-sm leading-relaxed text-zinc-500">{t('step3Description')}</p>
      <div className="rounded-xl bg-zinc-50 px-4 py-3 text-left">
        <p className="text-sm text-zinc-600">{t('step3Detail')}</p>
      </div>
    </div>
  );
}

function Step4({ t }: { t: ReturnType<typeof useTranslations<'onboarding'>> }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-4 text-4xl">{t('celebrationEmoji')}</div>
      <div className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-purple-50">
        <Map className="size-8 text-purple-500" />
      </div>
      <h2 className="mb-3 text-xl font-bold text-zinc-900">{t('step4Title')}</h2>
      <p className="mb-4 text-sm leading-relaxed text-zinc-500">{t('step4Description')}</p>
      <div className="rounded-xl bg-zinc-50 px-4 py-3 text-left">
        <p className="text-sm text-zinc-600">{t('step4Detail')}</p>
      </div>
    </div>
  );
}

export function OnboardingWizard({ projectId }: OnboardingWizardProps) {
  const t = useTranslations('onboarding');
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const key = `onboarding_completed_${projectId}`;
    if (!localStorage.getItem(key)) {
      setOpen(true);
    }
  }, [projectId]);

  function dismiss() {
    localStorage.setItem(`onboarding_completed_${projectId}`, '1');
    setOpen(false);
  }

  function next() {
    if (step < TOTAL - 1) {
      setStep((s) => s + 1);
    } else {
      dismiss();
    }
  }

  if (!open) return null;

  const isLast = step === TOTAL - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={dismiss}
      />

      {/* Dialog */}
      <div className="relative z-10 mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        {/* Close */}
        <button
          onClick={dismiss}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>

        {/* Step indicator dots */}
        <div className="mb-6 flex justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === step ? 'w-6 bg-zinc-800' : 'w-1.5 bg-zinc-200',
              )}
              aria-label={`Go to step ${i + 1}`}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="min-h-[320px]">
          {step === 0 && <Step1 t={t} />}
          {step === 1 && <Step2 t={t} />}
          {step === 2 && <Step3 t={t} />}
          {step === 3 && <Step4 t={t} />}
        </div>

        {/* Navigation */}
        <div className="mt-6 flex items-center justify-between">
          <div>
            {step > 0 ? (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800 transition-colors"
              >
                <ChevronLeft className="size-4" />
                {t('prev')}
              </button>
            ) : (
              <button
                onClick={dismiss}
                className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                {t('skip')}
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-400">
              {t('stepOf', { current: step + 1, total: TOTAL })}
            </span>
            <button
              onClick={next}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                isLast
                  ? 'bg-amber-500 text-white hover:bg-amber-600'
                  : 'bg-zinc-900 text-white hover:bg-zinc-700',
              )}
            >
              {isLast ? t('finish') : t('next')}
              {!isLast && <ChevronRight className="size-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
