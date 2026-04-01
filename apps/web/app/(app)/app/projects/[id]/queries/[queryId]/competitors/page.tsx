import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Users, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  params: Promise<{ id: string; queryId: string }>;
}

export default async function QueryCompetitorsPage({ params }: Props) {
  const [session, { id, queryId }, t] = await Promise.all([
    auth(),
    params,
    getTranslations('queryCompetitors'),
  ]);

  const targetQuery = await db.targetQuery.findFirst({
    where: { id: queryId, project: { id, userId: session!.user.id } },
    select: { id: true },
  });
  if (!targetQuery) notFound();

  // Fetch all competitor appearances for this query, grouped by competitor
  const appearances = await db.competitorQueryAppearance.findMany({
    where: { targetQueryId: queryId },
    include: {
      competitor: { select: { id: true, name: true, websiteUrl: true } },
    },
    orderBy: { checkedAt: 'desc' },
  });

  // Aggregate: count appearances per competitor, track last seen + avg position
  const byCompetitor = new Map<
    string,
    { name: string; websiteUrl: string | null; count: number; lastSeen: Date; positions: number[] }
  >();
  for (const a of appearances) {
    const prev = byCompetitor.get(a.competitorId);
    if (prev) {
      prev.count += 1;
      if (a.checkedAt > prev.lastSeen) prev.lastSeen = a.checkedAt;
      if (a.position != null) prev.positions.push(a.position);
    } else {
      byCompetitor.set(a.competitorId, {
        name: a.competitor.name,
        websiteUrl: a.competitor.websiteUrl,
        count: 1,
        lastSeen: a.checkedAt,
        positions: a.position != null ? [a.position] : [],
      });
    }
  }

  const ranked = [...byCompetitor.values()].sort((a, b) => b.count - a.count);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
          <Users className="size-4 text-zinc-400" />
          {t('title')}
        </h2>
        <p className="mt-0.5 text-xs text-zinc-400">{t('subtitle')}</p>
      </div>

      {ranked.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50">
            <Users className="size-5 text-zinc-300" />
          </div>
          <p className="text-sm font-semibold text-zinc-700">{t('emptyTitle')}</p>
          <p className="mt-1 max-w-xs text-xs text-zinc-400">{t('emptySubtitle')}</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-sm divide-y divide-zinc-50">
          {ranked.map((c, i) => {
            const avgPos =
              c.positions.length > 0
                ? Math.round(c.positions.reduce((s, v) => s + v, 0) / c.positions.length)
                : null;
            return (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                {/* Rank badge */}
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold tabular-nums text-zinc-500">
                  {i + 1}
                </span>

                {/* Competitor info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-800">{c.name}</p>
                  {c.websiteUrl && (
                    <a
                      href={c.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-zinc-400 transition-colors hover:text-zinc-600"
                    >
                      <ExternalLink className="size-2.5" />
                      {c.websiteUrl.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                </div>

                {/* Stats */}
                <div className="flex shrink-0 items-center gap-4 text-right">
                  {avgPos != null && (
                    <div>
                      <p className="text-xs text-zinc-400">{t('avgPosition')}</p>
                      <p
                        className={cn(
                          'text-sm font-semibold tabular-nums',
                          avgPos <= 3 ? 'text-red-500' : avgPos <= 6 ? 'text-amber-500' : 'text-zinc-500',
                        )}
                      >
                        #{avgPos}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-zinc-400">{t('appearances')}</p>
                    <p className="text-sm font-semibold tabular-nums text-zinc-700">{c.count}×</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
