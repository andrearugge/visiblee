import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Bell, BarChart2, BellRing, Lightbulb, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

function NotificationIcon({ type }: { type: string }) {
  if (type === 'analysis_complete') return <BarChart2 className="size-4 text-green-500" />;
  if (type === 'score_change') return <BellRing className="size-4 text-amber-500" />;
  if (type === 'new_recommendations') return <Lightbulb className="size-4 text-blue-500" />;
  return <Info className="size-4 text-zinc-400" />;
}

export default async function NotificationsPage() {
  const [session, t] = await Promise.all([auth(), getTranslations('notifications')]);

  const notifications = await db.notification.findMany({
    where: { userId: session!.user.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-xl font-semibold text-zinc-900">{t('title')}</h1>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-white py-16 text-center shadow-sm">
          <Bell className="mb-3 size-10 text-zinc-200" />
          <p className="text-sm font-medium text-zinc-600">{t('empty')}</p>
          <p className="mt-1 text-sm text-zinc-400">{t('emptySubtitle')}</p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          {notifications.map((n) => {
            const row = (
              <div
                className={cn(
                  'flex items-start gap-3 px-4 py-3',
                  !n.isRead && 'bg-blue-50/40',
                )}
              >
                <div className="mt-0.5 shrink-0">
                  <NotificationIcon type={n.type} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm', n.isRead ? 'text-zinc-600' : 'font-medium text-zinc-900')}>
                    {n.title}
                  </p>
                  {n.message && (
                    <p className="mt-0.5 text-xs text-zinc-500">{n.message}</p>
                  )}
                  <p className="mt-1 text-xs text-zinc-400">
                    {n.createdAt.toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}{' '}
                    {n.createdAt.toLocaleTimeString(undefined, {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                {!n.isRead && (
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-500" />
                )}
              </div>
            );

            return n.projectId ? (
              <Link key={n.id} href={`/app/projects/${n.projectId}/overview`} className="block hover:bg-zinc-50 transition-colors">
                {row}
              </Link>
            ) : (
              <div key={n.id}>{row}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
