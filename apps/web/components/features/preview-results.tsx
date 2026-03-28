'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { HelpCircle, CheckCircle2, Lock, ArrowRight, Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { buttonVariants } from '@/lib/button-variants';
import { cn } from '@/lib/utils';
import { useFormatNumber } from '@/hooks/use-format-number';
import { sendGAEvent } from '@/lib/analytics';
import { ScoreRadarChart } from './score-radar-chart';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface PreviewData {
  id: string;
  websiteUrl: string;
  brandName: string;
  aiReadinessScore: number;
  fanoutCoverageScore: number;
  citationPowerScore: number;
  extractabilityScore: number;
  entityAuthorityScore: number;
  sourceAuthorityScore: number;
  insights: string[];
  contentsFound: number;
}

interface ScoreRowProps {
  label: string;
  description: string;
  value: number;
}

function ScoreRow({ label, description, value }: ScoreRowProps) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400';
  const { format } = useFormatNumber();

  return (
    <div className="flex items-center gap-3">
      <div className="w-32 shrink-0 text-sm font-medium text-zinc-700">{label}</div>
      <div className="flex-1">
        <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
          <div
            className={cn('h-full rounded-full transition-all', color)}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <div className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums text-zinc-800">
        {format(pct)}
      </div>
      <TooltipProvider delay={200}>
        <Tooltip>
          <TooltipTrigger render={<button className="text-zinc-300 hover:text-zinc-500" />}>
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

function EmailReportForm({ previewId }: { previewId: string }) {
  const t = useTranslations('preview');
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function handleSend() {
    setStatus('sending');
    try {
      const res = await fetch(`/api/preview/${previewId}/send-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setStatus('sent');
        sendGAEvent('report_requested', { preview_id: previewId });
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }

  if (status === 'sent') {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
        <CheckCircle2 className="size-4 shrink-0" />
        {t('emailSuccess')}
      </div>
    );
  }

  if (!open) {
    return (
      <Button variant="outline" className="w-full gap-2" onClick={() => setOpen(true)}>
        <Mail className="size-4" />
        {t('emailCta')}
      </Button>
    );
  }

  return (
    <div className="flex gap-2">
      <Input
        type="email"
        placeholder={t('emailPlaceholder')}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="h-10 flex-1"
        autoFocus
      />
      <Button
        onClick={handleSend}
        disabled={status === 'sending' || !email}
        className="h-10 gap-1.5"
      >
        {status === 'sending' ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          t('emailSend')
        )}
      </Button>
    </div>
  );
}

const LOCKED_FEATURES = [
  'lockedFeature1',
  'lockedFeature2',
  'lockedFeature3',
  'lockedFeature4',
] as const;

interface PreviewResultsProps {
  data: PreviewData;
}

export function PreviewResults({ data }: PreviewResultsProps) {
  const t = useTranslations('preview');
  const { format } = useFormatNumber();

  useEffect(() => {
    sendGAEvent('preview_viewed', { preview_id: data.id });
  }, [data.id]);

  const aiScore = Math.round(data.aiReadinessScore * 100);

  const scoreRows = [
    { key: 'queryReach', label: t('queryReach'), description: t('queryReachDescription'), value: data.fanoutCoverageScore },
    { key: 'citationPower', label: t('citationPower'), description: t('citationPowerDescription'), value: data.citationPowerScore },
    { key: 'extractability', label: t('extractability'), description: t('extractabilityDescription'), value: data.extractabilityScore },
    { key: 'brandAuthority', label: t('brandAuthority'), description: t('brandAuthorityDescription'), value: data.entityAuthorityScore },
    { key: 'sourceAuthority', label: t('sourceAuthority'), description: t('sourceAuthorityDescription'), value: data.sourceAuthorityScore },
  ];

  return (
    <div className="relative overflow-hidden">
      {/* Background blob */}
      <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 -z-10 h-[500px] w-[500px] rounded-full bg-visiblee-green-100/30 blur-[100px]" />

      <div className="mx-auto max-w-4xl px-4 py-12">
        {/* Header */}
        <div className="mb-2 text-sm font-medium text-zinc-400">{t('poweredBy')}</div>
        <h1 className="mb-1 text-2xl font-bold text-zinc-900">{data.brandName}</h1>
        <p className="mb-10 text-sm text-zinc-400 truncate">{data.websiteUrl}</p>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Left — main score + radar */}
          <div className="space-y-6">
            {/* AI Readiness Score */}
            <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 text-center shadow-sm">
              <p className="mb-1 text-sm font-medium text-zinc-500">{t('aiReadinessScore')}</p>
              <div className="my-4 flex items-end justify-center gap-1">
                <span className="text-7xl font-bold leading-none tracking-tight text-zinc-900">
                  {format(aiScore)}
                </span>
                <span className="mb-2 text-2xl font-medium text-zinc-300">{t('outOf100')}</span>
              </div>
              <p className="text-xs text-zinc-400">{t('aiReadinessDescription')}</p>
            </div>

            {/* Radar chart */}
            <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm">
              <ScoreRadarChart
                scores={{
                  queryReach: data.fanoutCoverageScore,
                  citationPower: data.citationPowerScore,
                  extractability: data.extractabilityScore,
                  brandAuthority: data.entityAuthorityScore,
                  sourceAuthority: data.sourceAuthorityScore,
                }}
              />
            </div>
          </div>

          {/* Right — score rows + insights */}
          <div className="space-y-6">
            {/* Score breakdown */}
            <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm">
              <h2 className="mb-5 text-sm font-semibold uppercase tracking-wider text-zinc-400">
                {t('scoreBreakdown')}
              </h2>
              <div className="space-y-4">
                {scoreRows.map((row) => (
                  <ScoreRow key={row.key} label={row.label} description={row.description} value={row.value} />
                ))}
              </div>
            </div>

            {/* Insights */}
            {data.insights && data.insights.length > 0 ? (
              <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-400">
                  {t('insights')}
                </h2>
                <ul className="space-y-3">
                  {data.insights.map((insight, i) => (
                    <li key={i} className="flex gap-2.5 text-sm text-zinc-700">
                      <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-visiblee-green-400 mt-1.5" />
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>

        {/* Locked section */}
        <div className="relative mt-8 overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm">
          {/* Blurred content preview */}
          <div className="select-none blur-sm pointer-events-none p-6 space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex gap-3 items-center">
                <div className="h-3 w-48 rounded bg-zinc-100" />
                <div className="h-2 flex-1 rounded bg-zinc-50" />
                <div className="h-3 w-12 rounded bg-zinc-100" />
              </div>
            ))}
          </div>

          {/* Overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 px-6 py-8 text-center backdrop-blur-[2px]">
            <Lock className="mb-3 size-6 text-zinc-400" />
            <h3 className="mb-1 text-base font-semibold text-zinc-900">{t('lockedTitle')}</h3>
            <p className="mb-5 max-w-sm text-sm text-zinc-500">{t('lockedSubtitle')}</p>
            <ul className="mb-6 space-y-1.5 text-left text-sm text-zinc-600">
              {LOCKED_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 shrink-0 text-visiblee-green-500" />
                  {t(f)}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* CTAs */}
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <EmailReportForm previewId={data.id} />
          <Link
            href={`/register?preview=${data.id}`}
            onClick={() => sendGAEvent('registration_started', { preview_id: data.id })}
            className={cn(buttonVariants(), 'w-full gap-2')}
          >
            {t('registerCta')}
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
