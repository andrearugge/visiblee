'use client';

import { useTranslations } from 'next-intl';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts';

interface ScoreRadarChartProps {
  scores: {
    queryReach: number;
    citationPower: number;
    extractability: number;
    brandAuthority: number;
    sourceAuthority: number;
  };
}

export function ScoreRadarChart({ scores }: ScoreRadarChartProps) {
  const t = useTranslations('scores');
  const data = [
    { subject: t('queryReach.label'), value: Math.round(scores.queryReach * 100) },
    { subject: t('citationPower.label'), value: Math.round(scores.citationPower * 100) },
    { subject: t('extractability.label'), value: Math.round(scores.extractability * 100) },
    { subject: t('brandAuthority.label'), value: Math.round(scores.brandAuthority * 100) },
    { subject: t('sourceAuthority.label'), value: Math.round(scores.sourceAuthority * 100) },
  ];

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
        <PolarGrid stroke="#e4e4e7" />
        <PolarAngleAxis
          dataKey="subject"
          tick={{ fontSize: 11, fill: '#71717a' }}
        />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        <Radar
          name="Score"
          dataKey="value"
          stroke="#f59e0b"
          fill="#f59e0b"
          fillOpacity={0.15}
          strokeWidth={2}
          dot={{ fill: '#f59e0b', r: 3 }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
