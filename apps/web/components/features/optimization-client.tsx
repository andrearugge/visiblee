'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, Zap, BookOpen, Globe, CheckCircle2, Clock, XCircle, Circle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Recommendation {
  id: string;
  type: string;
  priority: string;
  effort: string;
  title: string;
  description: string;
  suggestedAction: string | null;
  targetScore: string | null;
  status: string;
}

interface OptimizationClientProps {
  projectId: string;
  recommendations: Recommendation[];
  isStale?: boolean;
}

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

const SCORE_KEY_MAP: Record<string, string> = {
  fanout_coverage_score: 'queryReach',
  citation_power_score: 'citationPower',
  extractability_score: 'extractability',
  entity_authority_score: 'brandAuthority',
  source_authority_score: 'sourceAuthority',
};

function TypeBadge({ type }: { type: string }) {
  const t = useTranslations('optimization');
  if (type === 'quick_win') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
        <Zap className="size-3" />
        {t('typeQuickWin')}
      </span>
    );
  }
  if (type === 'content_gap') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
        <BookOpen className="size-3" />
        {t('typeContentGap')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
      <Globe className="size-3" />
      {t('typePlatformOpportunity')}
    </span>
  );
}

function EffortBadge({ effort }: { effort: string }) {
  const t = useTranslations('optimization');
  const label =
    effort === 'quick'
      ? t('effortQuick')
      : effort === 'moderate'
      ? t('effortModerate')
      : t('effortSignificant');
  const color =
    effort === 'quick'
      ? 'bg-zinc-100 text-zinc-600'
      : effort === 'moderate'
      ? 'bg-amber-50 text-amber-700'
      : 'bg-red-50 text-red-600';
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', color)}>{label}</span>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'completed') return <CheckCircle2 className="size-4 text-green-500" />;
  if (status === 'in_progress') return <Clock className="size-4 text-amber-500" />;
  if (status === 'dismissed') return <XCircle className="size-4 text-zinc-300" />;
  return <Circle className="size-4 text-zinc-300" />;
}

function RecommendationCard({ rec, projectId }: { rec: Recommendation; projectId: string }) {
  const t = useTranslations('optimization');
  const tScores = useTranslations('scores');
  const [status, setStatus] = useState(rec.status);
  const [expanded, setExpanded] = useState(true);
  const [updating, setUpdating] = useState(false);

  async function updateStatus(newStatus: string) {
    setUpdating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/recommendations/${rec.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) setStatus(newStatus);
    } finally {
      setUpdating(false);
    }
  }

  const isDismissed = status === 'dismissed';

  return (
    <div
      className={cn(
        'rounded-2xl border bg-white shadow-sm transition-opacity',
        isDismissed ? 'border-zinc-100 opacity-60' : 'border-zinc-200/80',
      )}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0">
            <StatusIcon status={status} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <TypeBadge type={rec.type} />
              <EffortBadge effort={rec.effort} />
              {rec.targetScore && (
                <span className="text-xs text-zinc-400">
                  {t('targetScore')}: <span className="font-medium text-zinc-600">{SCORE_KEY_MAP[rec.targetScore] ? tScores(`${SCORE_KEY_MAP[rec.targetScore]}.label`) : rec.targetScore}</span>
                </span>
              )}
            </div>
            <p className={cn('text-sm font-medium', isDismissed ? 'text-zinc-400 line-through' : 'text-zinc-800')}>
              {rec.title}
            </p>
            <p className="mt-1 text-sm text-zinc-500 leading-relaxed">{rec.description}</p>
          </div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="ml-2 shrink-0 text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            <ChevronDown className={cn('size-4 transition-transform', expanded && 'rotate-180')} />
          </button>
        </div>

        {expanded && rec.suggestedAction && (
          <div className="mt-3 ml-7 rounded-xl bg-zinc-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
              {t('suggestedAction')}
            </p>
            <p className="text-sm text-zinc-700">{rec.suggestedAction}</p>
          </div>
        )}

        {/* Status actions */}
        {!isDismissed && (
          <div className="mt-3 ml-7 flex items-center gap-2">
            {status === 'pending' && (
              <>
                <button
                  onClick={() => updateStatus('in_progress')}
                  disabled={updating}
                  className="text-xs text-zinc-500 hover:text-zinc-800 transition-colors disabled:opacity-50"
                >
                  {t('markInProgress')}
                </button>
                <span className="text-zinc-200">·</span>
                <button
                  onClick={() => updateStatus('completed')}
                  disabled={updating}
                  className="text-xs text-zinc-500 hover:text-green-600 transition-colors disabled:opacity-50"
                >
                  {t('markCompleted')}
                </button>
                <span className="text-zinc-200">·</span>
                <button
                  onClick={() => updateStatus('dismissed')}
                  disabled={updating}
                  className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors disabled:opacity-50"
                >
                  {t('dismiss')}
                </button>
              </>
            )}
            {status === 'in_progress' && (
              <>
                <button
                  onClick={() => updateStatus('completed')}
                  disabled={updating}
                  className="text-xs text-zinc-500 hover:text-green-600 transition-colors disabled:opacity-50"
                >
                  {t('markCompleted')}
                </button>
                <span className="text-zinc-200">·</span>
                <button
                  onClick={() => updateStatus('pending')}
                  disabled={updating}
                  className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors disabled:opacity-50"
                >
                  {t('markPending')}
                </button>
              </>
            )}
            {status === 'completed' && (
              <button
                onClick={() => updateStatus('pending')}
                disabled={updating}
                className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors disabled:opacity-50"
              >
                {t('markPending')}
              </button>
            )}
          </div>
        )}
        {isDismissed && (
          <div className="mt-3 ml-7">
            <button
              onClick={() => updateStatus('pending')}
              disabled={updating}
              className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors disabled:opacity-50"
            >
              {t('markPending')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PrioritySection({
  priority,
  recs,
  projectId,
}: {
  priority: string;
  recs: Recommendation[];
  projectId: string;
}) {
  const t = useTranslations('optimization');
  if (recs.length === 0) return null;

  const label =
    priority === 'high'
      ? t('highPriority')
      : priority === 'medium'
      ? t('mediumPriority')
      : t('lowPriority');

  const dotColor =
    priority === 'high'
      ? 'bg-red-400'
      : priority === 'medium'
      ? 'bg-amber-400'
      : 'bg-zinc-300';

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className={cn('size-2 rounded-full', dotColor)} />
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{label}</h2>
      </div>
      <div className="space-y-3">
        {recs.map((rec) => (
          <RecommendationCard key={rec.id} rec={rec} projectId={projectId} />
        ))}
      </div>
    </div>
  );
}

export function OptimizationClient({ projectId, recommendations, isStale }: OptimizationClientProps) {
  const t = useTranslations('optimization');
  const sorted = [...recommendations].sort(
    (a, b) => (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1),
  );

  const byPriority = {
    high: sorted.filter((r) => r.priority === 'high'),
    medium: sorted.filter((r) => r.priority === 'medium'),
    low: sorted.filter((r) => r.priority === 'low'),
  };

  return (
    <div className="space-y-8 p-6">
      {isStale && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-800">{t('staleWarning')}</p>
        </div>
      )}
      {(['high', 'medium', 'low'] as const).map((p) => (
        <PrioritySection key={p} priority={p} recs={byPriority[p]} projectId={projectId} />
      ))}
    </div>
  );
}
