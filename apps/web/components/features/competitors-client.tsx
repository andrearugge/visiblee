'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Plus,
  Trash2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Globe,
  ExternalLink,
  BarChart2,
  Link2,
  ChevronDown,
  ChevronUp,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useFormatNumber } from '@/hooks/use-format-number';

interface GapReport {
  gaps: string[];
  competitor_url?: string;
  competitor_domain?: string;
  query?: string;
}

interface Competitor {
  id: string;
  name: string;
  websiteUrl: string | null;
  isConfirmed: boolean;
  avgPassageScore: number | null;
  contentCount: number;
  createdAt: string;
  citationUrls: string[];
  queriesWithCitations: string[];
  gapReport: { gaps: unknown; generatedAt: string } | null;
}

interface CompetitorsClientProps {
  projectId: string;
  initialCompetitors: Competitor[];
  ownPassageScore: number | null;
}

function ScoreBar({ value, label, color = 'bg-zinc-900' }: { value: number; label: string; color?: string }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-xs text-zinc-500">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 shrink-0 text-right text-xs font-semibold tabular-nums text-zinc-700">
        {pct}
      </span>
    </div>
  );
}

function CompetitorCard({
  competitor,
  ownPassageScore,
  projectId,
  onDelete,
  onAnalysisQueued,
}: {
  competitor: Competitor;
  ownPassageScore: number | null;
  projectId: string;
  onDelete: (id: string) => void;
  onAnalysisQueued: (id: string) => void;
}) {
  const t = useTranslations('competitors');
  const { format } = useFormatNumber();
  const [analysisStatus, setAnalysisStatus] = useState<'idle' | 'loading' | 'queued' | 'error'>('idle');
  const [deleting, setDeleting] = useState(false);
  const [gapOpen, setGapOpen] = useState(false);

  async function handleAnalyze() {
    setAnalysisStatus('loading');
    const res = await fetch(`/api/projects/${projectId}/competitors/${competitor.id}/analyze`, {
      method: 'POST',
    });
    if (res.ok) {
      setAnalysisStatus('queued');
      onAnalysisQueued(competitor.id);
    } else {
      setAnalysisStatus('error');
    }
  }

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/projects/${projectId}/competitors/${competitor.id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      onDelete(competitor.id);
    } else {
      setDeleting(false);
    }
  }

  const displayDomain = competitor.websiteUrl
    ? (() => { try { return new URL(competitor.websiteUrl).hostname; } catch { return competitor.websiteUrl; } })()
    : null;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-zinc-900 truncate">{competitor.name}</p>
            {competitor.isConfirmed && (
              <span className="shrink-0 rounded-md bg-green-50 px-1.5 py-0.5 text-xs font-medium text-green-700">
                {t('analyzed')}
              </span>
            )}
          </div>
          {displayDomain && (
            <a
              href={competitor.websiteUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              <Globe className="size-3" />
              {displayDomain}
              <ExternalLink className="size-2.5" />
            </a>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {analysisStatus === 'queued' ? (
            <span className="flex items-center gap-1.5 text-xs text-zinc-500">
              <Loader2 className="size-3.5 animate-spin" />
              {t('analyzing')}
            </span>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={handleAnalyze}
              disabled={analysisStatus === 'loading'}
              className="h-7 gap-1.5 text-xs"
            >
              <RefreshCw className={cn('size-3', analysisStatus === 'loading' && 'animate-spin')} />
              {t('runAnalysis')}
            </Button>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            aria-label={t('deleteAriaLabel')}
            className="text-zinc-300 hover:text-red-400 transition-colors disabled:opacity-50"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Citation URLs */}
      {competitor.citationUrls.length > 0 ? (
        <div className="mb-4 rounded-lg border border-zinc-100 bg-zinc-50 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {t('citationUrlsTitle')}
            </p>
            {competitor.queriesWithCitations.length > 0 && (
              <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-500 tabular-nums">
                {t('appearedInQueries', { count: competitor.queriesWithCitations.length })}
              </span>
            )}
          </div>
          <ul className="space-y-1.5">
            {competitor.citationUrls.map((url, i) => {
              let display = url;
              try { display = new URL(url).pathname || url; } catch {}
              return (
                <li key={i} className="flex items-start gap-1.5 min-w-0">
                  <Link2 className="mt-0.5 size-3 shrink-0 text-zinc-400" />
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={url}
                    className="truncate text-xs text-zinc-600 hover:text-zinc-900 hover:underline transition-colors"
                  >
                    {display}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="mb-4 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2.5">
          <p className="text-xs text-zinc-400">{t('noCitationsTracked')}</p>
        </div>
      )}

      {/* Content quality comparison */}
      {competitor.isConfirmed && competitor.avgPassageScore !== null && (
        <div className="space-y-2.5 rounded-lg border border-zinc-100 bg-zinc-50 p-3">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
            {t('comparisonTitle')}
          </p>
          {ownPassageScore !== null && (
            <ScoreBar
              value={ownPassageScore}
              label={t('yours')}
              color="bg-amber-400"
            />
          )}
          <ScoreBar
            value={competitor.avgPassageScore}
            label={competitor.name}
            color="bg-zinc-400"
          />
          <p className="pt-0.5 text-xs text-zinc-400">{t('avgPassageScore')}</p>
        </div>
      )}

      {/* Gap report */}
      {competitor.gapReport && (() => {
        const report = competitor.gapReport.gaps as unknown as GapReport;
        const gaps: string[] = Array.isArray(report.gaps) ? report.gaps : [];
        return (
          <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50">
            <button
              onClick={() => setGapOpen((v) => !v)}
              className="flex w-full items-center justify-between px-3 py-2 text-left"
            >
              <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                <TrendingUp className="size-3.5" />
                {t('gapReportTitle')}
                {gaps.length > 0 && (
                  <span className="ml-1 rounded-full bg-amber-200 px-1.5 py-0.5 text-xs font-medium text-amber-800 tabular-nums">
                    {gaps.length}
                  </span>
                )}
              </span>
              {gapOpen ? (
                <ChevronUp className="size-3.5 text-amber-500" />
              ) : (
                <ChevronDown className="size-3.5 text-amber-500" />
              )}
            </button>
            {gapOpen && (
              <div className="border-t border-amber-100 px-3 pb-3 pt-2">
                {gaps.length === 0 ? (
                  <p className="text-xs text-amber-600">{t('noGaps')}</p>
                ) : (
                  <ul className="space-y-1.5">
                    {gaps.map((gap, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-amber-800">
                        <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-amber-400" />
                        {gap}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Not analyzed note */}
      {!competitor.isConfirmed && competitor.contentCount === 0 && (
        <p className="text-xs italic text-zinc-300">{t('notAnalyzed')}</p>
      )}
    </div>
  );
}

export function CompetitorsClient({
  projectId,
  initialCompetitors,
  ownPassageScore,
}: CompetitorsClientProps) {
  const t = useTranslations('competitors');
  const [competitors, setCompetitors] = useState<Competitor[]>(initialCompetitors);
  const [nameInput, setNameInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  async function handleAdd() {
    setAddError(null);
    if (!nameInput.trim()) { setAddError('name'); return; }
    if (!urlInput.trim()) { setAddError('url'); return; }

    setAdding(true);
    const res = await fetch(`/api/projects/${projectId}/competitors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nameInput.trim(), websiteUrl: urlInput.trim() }),
    });

    if (res.ok) {
      const newCompetitor = await res.json();
      setCompetitors((prev) => [...prev, { ...newCompetitor, citationUrls: [], queriesWithCitations: [] }]);
      setNameInput('');
      setUrlInput('');
    } else {
      const body = await res.json().catch(() => ({}));
      if (body.error === 'invalid_url') setAddError('url');
      else setAddError('generic');
    }
    setAdding(false);
  }

  function handleDelete(id: string) {
    setCompetitors((prev) => prev.filter((c) => c.id !== id));
  }

  function handleAnalysisQueued(_id: string) {
    // competitor card manages its own state
  }

  return (
    <div className="p-6">
      {/* Add form */}
      <div className="mb-6 rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-zinc-900">{t('title')}</h3>
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1 min-w-[180px]">
            <Input
              type="text"
              placeholder={t('addName')}
              value={nameInput}
              onChange={(e) => { setNameInput(e.target.value); setAddError(null); }}
              className="h-8 text-sm"
              disabled={adding}
            />
            {addError === 'name' && (
              <p className="mt-1 text-xs text-red-500">{t('addNameError')}</p>
            )}
          </div>
          <div className="flex-1 min-w-[220px]">
            <Input
              type="url"
              placeholder={t('addUrl')}
              value={urlInput}
              onChange={(e) => { setUrlInput(e.target.value); setAddError(null); }}
              onKeyDown={(e) => e.key === 'Enter' && !adding && handleAdd()}
              className="h-8 text-sm"
              disabled={adding}
            />
            {addError === 'url' && (
              <p className="mt-1 text-xs text-red-500">{t('addUrlError')}</p>
            )}
          </div>
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={adding}
            className="h-8 gap-1.5 shrink-0"
          >
            {adding ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            {adding ? t('adding') : t('add')}
          </Button>
        </div>
        {addError === 'generic' && (
          <p className="mt-2 flex items-center gap-1 text-xs text-red-500">
            <AlertCircle className="size-3" />
            {t('addError')}
          </p>
        )}
      </div>

      {/* Competitor list */}
      {competitors.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50">
            <BarChart2 className="size-6 text-zinc-400" />
          </div>
          <p className="mb-1 text-sm font-semibold text-zinc-700">{t('emptyTitle')}</p>
          <p className="max-w-xs text-xs text-zinc-400">{t('emptySubtitle')}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {competitors.map((c) => (
            <CompetitorCard
              key={c.id}
              competitor={c}
              ownPassageScore={ownPassageScore}
              projectId={projectId}
              onDelete={handleDelete}
              onAnalysisQueued={handleAnalysisQueued}
            />
          ))}
        </div>
      )}
    </div>
  );
}
