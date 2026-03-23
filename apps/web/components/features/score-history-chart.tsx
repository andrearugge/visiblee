'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface Snapshot {
  id: string;
  createdAt: string;
  aiReadinessScore: number;
  fanoutCoverageScore: number;
  citationPowerScore: number;
  extractabilityScore: number;
  entityAuthorityScore: number;
  sourceAuthorityScore: number;
}

interface ScoreHistoryChartProps {
  snapshots: Snapshot[];
}

const SUB_SCORES = [
  { key: 'fanoutCoverageScore', color: '#60a5fa', labelKey: 'queryReach' },
  { key: 'citationPowerScore', color: '#34d399', labelKey: 'citationPower' },
  { key: 'extractabilityScore', color: '#a78bfa', labelKey: 'extractability' },
  { key: 'entityAuthorityScore', color: '#f472b6', labelKey: 'brandAuthority' },
  { key: 'sourceAuthorityScore', color: '#fb923c', labelKey: 'sourceAuthority' },
] as const;

export function ScoreHistoryChart({ snapshots }: ScoreHistoryChartProps) {
  const t = useTranslations('overview.history');
  const locale = useLocale();
  const [visibleLines, setVisibleLines] = useState<Set<string>>(new Set(['aiReadinessScore']));

  if (snapshots.length < 2) return null;

  const data = snapshots.map((s) => ({
    date: new Date(s.createdAt).toLocaleDateString(locale, { day: '2-digit', month: '2-digit' }),
    aiReadinessScore: Math.round(s.aiReadinessScore * 100),
    fanoutCoverageScore: Math.round(s.fanoutCoverageScore * 100),
    citationPowerScore: Math.round(s.citationPowerScore * 100),
    extractabilityScore: Math.round(s.extractabilityScore * 100),
    entityAuthorityScore: Math.round(s.entityAuthorityScore * 100),
    sourceAuthorityScore: Math.round(s.sourceAuthorityScore * 100),
  }));

  function toggleLine(key: string) {
    setVisibleLines((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key); // always keep at least one
      } else {
        next.add(key);
      }
      return next;
    });
  }

  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm">
      <h2 className="mb-5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
        {t('title')}
      </h2>

      {/* Legend toggles */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => toggleLine('aiReadinessScore')}
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-opacity ${
            visibleLines.has('aiReadinessScore') ? 'opacity-100' : 'opacity-40'
          }`}
        >
          <span className="size-2 rounded-full bg-amber-400 inline-block" />
          {t('aiReadiness')}
        </button>
        {SUB_SCORES.map((s) => (
          <button
            key={s.key}
            onClick={() => toggleLine(s.key)}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-opacity ${
              visibleLines.has(s.key) ? 'opacity-100' : 'opacity-40'
            }`}
          >
            <span className="size-2 rounded-full inline-block" style={{ backgroundColor: s.color }} />
            {t(s.labelKey)}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#a1a1aa' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: '#a1a1aa' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: '1px solid #e4e4e7',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
            }}
          />
          {/* Primary line — AI Readiness */}
          {visibleLines.has('aiReadinessScore') && (
            <Line
              type="monotone"
              dataKey="aiReadinessScore"
              name={t('aiReadiness')}
              stroke="#f59e0b"
              strokeWidth={2}
              dot={{ fill: '#f59e0b', r: 3 }}
              activeDot={{ r: 5 }}
            />
          )}
          {/* Sub-score lines */}
          {SUB_SCORES.map((s) =>
            visibleLines.has(s.key) ? (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={t(s.labelKey)}
                stroke={s.color}
                strokeWidth={1.5}
                strokeDasharray="4 2"
                dot={false}
              />
            ) : null,
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
