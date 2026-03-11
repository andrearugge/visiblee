'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FolderOpen, Settings, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AppSidebarProps {
  isSuperadmin?: boolean;
}

const LINKS = [
  { href: '/app', i18nKey: 'projects' as const, icon: FolderOpen, exact: true },
  { href: '/app/settings', i18nKey: 'settings' as const, icon: Settings },
];

const ADMIN_LINKS = [
  { href: '/admin', i18nKey: 'users' as const, icon: Users },
];

export function AppSidebar({ isSuperadmin = false }: AppSidebarProps) {
  const t = useTranslations('nav');
  const pathname = usePathname();

  return (
    <aside className="flex w-56 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {LINKS.map(({ href, i18nKey, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
              )}
            >
              <Icon className="size-4 shrink-0" />
              {t(i18nKey)}
            </Link>
          );
        })}

        {isSuperadmin ? (
          <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Admin
            </p>
            {ADMIN_LINKS.map(({ href, i18nKey, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                      : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {t(i18nKey)}
                </Link>
              );
            })}
          </div>
        ) : null}
      </nav>
    </aside>
  );
}
