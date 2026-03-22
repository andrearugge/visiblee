'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Bell, CheckCheck, BellRing, BarChart2, Lightbulb, Info, X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { buttonVariants } from '@/lib/button-variants';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  isRead: boolean;
  projectId: string | null;
  createdAt: string;
}

function NotificationIcon({ type }: { type: string }) {
  if (type === 'analysis_complete') return <BarChart2 className="size-4 text-green-500" />;
  if (type === 'score_change') return <BellRing className="size-4 text-amber-500" />;
  if (type === 'new_recommendations') return <Lightbulb className="size-4 text-blue-500" />;
  return <Info className="size-4 text-zinc-400" />;
}

function NotificationItem({
  notification,
  onRead,
}: {
  notification: Notification;
  onRead: (id: string) => void;
}) {
  const date = new Date(notification.createdAt);
  const timeAgo = formatTimeAgo(date);

  const content = (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3 transition-colors hover:bg-zinc-50',
        !notification.isRead && 'bg-blue-50/50 hover:bg-blue-50',
      )}
      onClick={() => !notification.isRead && onRead(notification.id)}
    >
      <div className="mt-0.5 shrink-0">
        <NotificationIcon type={notification.type} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm', notification.isRead ? 'text-zinc-600' : 'font-medium text-zinc-900')}>
          {notification.title}
        </p>
        {notification.message && (
          <p className="mt-0.5 text-xs text-zinc-500 leading-relaxed">{notification.message}</p>
        )}
        <p className="mt-1 text-xs text-zinc-400">{timeAgo}</p>
      </div>
      {!notification.isRead && (
        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-500" />
      )}
    </div>
  );

  if (notification.projectId) {
    return (
      <Link href={`/app/projects/${notification.projectId}/overview`} className="block">
        {content}
      </Link>
    );
  }
  return <div className="cursor-default">{content}</div>;
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function NotificationBell() {
  const t = useTranslations('notifications');
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    } catch {
      // ignore
    }
  }, []);

  // Fetch on mount and every 60s
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Fetch when panel opens
  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  async function markRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    await fetch(`/api/notifications/${id}`, { method: 'PATCH' });
  }

  async function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    await fetch('/api/notifications/mark-all-read', { method: 'POST' });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label={t('title')}
        className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'relative')}
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-sm" showCloseButton={false}>
        <SheetHeader className="flex flex-row items-center justify-between border-b border-zinc-100 px-4 py-3">
          <SheetTitle className="text-base">{t('title')}</SheetTitle>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 transition-colors"
              >
                <CheckCheck className="size-3.5" />
                {t('markAllRead')}
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="p-8 text-center text-sm text-zinc-400">Loading…</div>
          )}
          {!loading && notifications.length === 0 && (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <Bell className="mb-3 size-8 text-zinc-200" />
              <p className="text-sm font-medium text-zinc-600">{t('empty')}</p>
              <p className="mt-1 text-xs text-zinc-400">{t('emptySubtitle')}</p>
            </div>
          )}
          {notifications.map((n) => (
            <NotificationItem key={n.id} notification={n} onRead={markRead} />
          ))}
        </div>

        {notifications.length > 0 && (
          <div className="border-t border-zinc-100 p-3">
            <Link
              href="/app/notifications"
              onClick={() => setOpen(false)}
              className="block rounded-lg py-2 text-center text-xs font-medium text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50 transition-colors"
            >
              {t('viewAll')}
            </Link>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
