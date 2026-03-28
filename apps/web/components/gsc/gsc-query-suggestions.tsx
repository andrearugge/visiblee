'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Lightbulb, Bot, Loader2, X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GscSuggestion {
  id: string;
  query: string;
  reason: string;
  intentType: string;
  impressions: number;
  clicks: number;
  avgPosition: number;
  similarityScore: number | null;
}

interface GscQuerySuggestionsProps {
  projectId: string;
  suggestions: GscSuggestion[];
}

const REASON_KEYS: Record<string, 'reasonAiMode' | 'reasonHighCommercialIntent' | 'reasonHighVisibility' | 'reasonCoverageGap'> = {
  query_ai_mode: 'reasonAiMode',
  high_commercial_intent: 'reasonHighCommercialIntent',
  high_visibility: 'reasonHighVisibility',
  coverage_gap: 'reasonCoverageGap',
};

export function GscQuerySuggestions({ projectId, suggestions: initialSuggestions }: GscQuerySuggestionsProps) {
  const t = useTranslations('gsc.suggestions');
  const router = useRouter();

  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const [loading, setLoading] = useState<Record<string, 'accept' | 'dismiss'>>({});

  if (suggestions.length === 0) return null;

  async function handleAction(id: string, action: 'accept' | 'dismiss') {
    setLoading((prev) => ({ ...prev, [id]: action }));
    const res = await fetch(`/api/gsc/suggestions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    setLoading((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (res.ok) {
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
      if (action === 'accept') router.refresh();
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      {/* Banner header */}
      <div className="mb-3 flex items-center gap-2">
        <Lightbulb className="size-4 shrink-0 text-visiblee-green-500" />
        <p className="text-sm font-semibold text-zinc-800">
          {t('bannerTitle', { count: suggestions.length })}
        </p>
      </div>

      {/* Suggestion list */}
      <div className="space-y-2">
        {suggestions.map((s) => {
          const isLoading = !!loading[s.id];
          const isAiQuery = s.reason === 'query_ai_mode';
          const reasonKey = REASON_KEYS[s.reason] ?? 'reasonCoverageGap';

          return (
            <div
              key={s.id}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-800 truncate">"{s.query}"</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-xs text-zinc-400">
                      {t('impressions', { count: s.impressions })}
                    </span>
                    <span className="text-xs text-zinc-400">
                      {t('intentLabel')}: <span className="text-zinc-600">{s.intentType}</span>
                    </span>
                    {isAiQuery && (
                      <span className="flex items-center gap-1 rounded-full bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                        <Bot className="size-2.5" />
                        {t('aiQueryBadge')}
                      </span>
                    )}
                    <span className="text-xs text-zinc-400">{t(reasonKey)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={() => handleAction(s.id, 'accept')}
                    disabled={isLoading}
                    className={cn(
                      'flex items-center gap-1 rounded-md border border-visiblee-green-200 bg-visiblee-green-50 px-2 py-1 text-xs font-medium text-visiblee-green-700 transition-colors hover:bg-visiblee-green-100 disabled:opacity-50',
                    )}
                  >
                    {loading[s.id] === 'accept' ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Plus className="size-3" />
                    )}
                    {t('addButton')}
                  </button>
                  <button
                    onClick={() => handleAction(s.id, 'dismiss')}
                    disabled={isLoading}
                    className="flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-50"
                  >
                    {loading[s.id] === 'dismiss' ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <X className="size-3" />
                    )}
                    {t('dismissButton')}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
