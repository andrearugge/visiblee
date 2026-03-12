'use client';

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from 'recharts';

interface ScoreRadarChartProps {
  scores: {
    queryReach: number;
    answerStrength: number;
    extractability: number;
    brandTrust: number;
    sourceAuthority: number;
  };
}

export function ScoreRadarChart({ scores }: ScoreRadarChartProps) {
  const data = [
    { subject: 'Query Reach', value: Math.round(scores.queryReach * 100) },
    { subject: 'Answer Strength', value: Math.round(scores.answerStrength * 100) },
    { subject: 'Extractability', value: Math.round(scores.extractability * 100) },
    { subject: 'Brand Trust', value: Math.round(scores.brandTrust * 100) },
    { subject: 'Source Authority', value: Math.round(scores.sourceAuthority * 100) },
  ];

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
        <PolarGrid stroke="#e4e4e7" />
        <PolarAngleAxis
          dataKey="subject"
          tick={{ fontSize: 11, fill: '#71717a' }}
        />
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
