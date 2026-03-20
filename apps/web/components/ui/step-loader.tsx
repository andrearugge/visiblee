'use client';

import { useState, useEffect } from 'react';
import { Loader2, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LoaderStep {
  icon: LucideIcon;
  label: string;
}

interface StepLoaderProps {
  title: string;
  subtitle: string;
  steps: LoaderStep[];
  /** Footer polling text shown below the skeleton */
  pollingText?: string;
  /** Shape of the skeleton rows shown while waiting */
  skeleton?: 'score-rows' | 'content-rows';
  /** Step cycling interval in ms (default 2500) */
  stepInterval?: number;
}

/**
 * Generic animated step loader.
 * Used whenever a background job is running and the user is waiting for results.
 * Shows a cycling icon, step pills, skeleton rows, and an optional polling footer.
 */
export function StepLoader({
  title,
  subtitle,
  steps,
  pollingText,
  skeleton = 'content-rows',
  stepInterval = 2500,
}: StepLoaderProps) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setStepIndex((i) => (i + 1) % steps.length), stepInterval);
    return () => clearInterval(id);
  }, [steps.length, stepInterval]);

  const ActiveIcon = steps[stepIndex].icon;

  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      {/* Animated icon */}
      <div className="relative mb-8 flex size-20 items-center justify-center">
        <div className="absolute inset-2 animate-pulse rounded-full bg-zinc-100" />
        <div className="relative flex size-14 items-center justify-center rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <ActiveIcon className="size-6 text-zinc-500 transition-all duration-300" />
        </div>
      </div>

      <h2 className="mb-2 text-lg font-semibold text-zinc-900">{title}</h2>
      <p className="mb-8 max-w-sm text-sm text-zinc-500">{subtitle}</p>

      {/* Step pills */}
      <div className="mb-10 flex items-center gap-2">
        {steps.map((step, i) => {
          const Icon = step.icon;
          const isActive = i === stepIndex;
          const isPast = i < stepIndex;
          return (
            <div
              key={i}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-300',
                isActive
                  ? 'animate-pulse bg-zinc-900 text-white shadow-sm'
                  : isPast
                    ? 'bg-zinc-100 text-zinc-400'
                    : 'bg-zinc-50 text-zinc-300',
              )}
            >
              <Icon className="size-3" />
              <span className={cn(!isActive && 'hidden sm:inline')}>{step.label}</span>
            </div>
          );
        })}
      </div>

      {/* Skeleton rows */}
      <div className="w-full max-w-2xl space-y-2">
        {skeleton === 'score-rows'
          ? [0.95, 0.8, 0.65].map((opacity, i) => (
              <div
                key={i}
                className="flex animate-pulse items-center gap-3 rounded-lg border border-zinc-100 bg-white px-4 py-3"
                style={{ opacity }}
              >
                <div className="h-4 w-28 rounded-full bg-zinc-100" />
                <div className="h-2 flex-1 rounded-full bg-zinc-100" />
                <div className="h-4 w-8 rounded bg-zinc-100" />
              </div>
            ))
          : [0.95, 0.8, 0.65].map((opacity, i) => (
              <div
                key={i}
                className="flex animate-pulse items-center gap-3 rounded-lg border border-zinc-100 bg-white px-4 py-3"
                style={{ opacity }}
              >
                <div className="size-4 rounded-full bg-zinc-100" />
                <div className="size-4 rounded-full bg-zinc-100" />
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <div className="h-4 w-16 rounded-full bg-zinc-100" />
                  </div>
                  <div className="h-3.5 w-3/4 rounded bg-zinc-100" />
                  <div className="h-3 w-1/2 rounded bg-zinc-50" />
                </div>
              </div>
            ))}
      </div>

      {/* Polling footer */}
      {pollingText && (
        <div className="mt-8 flex items-center gap-2 text-sm text-zinc-400">
          <Loader2 className="size-4 animate-spin" />
          {pollingText}
        </div>
      )}
    </div>
  );
}
