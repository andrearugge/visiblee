'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  FolderOpen,
  Settings,
  Users,
  BarChart2,
  Search,
  FileText,
  Map,
  Lightbulb,
  Bot,
  ChevronLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProject } from './project-context';

interface AppSidebarProps {
  isSuperadmin?: boolean;
}

const MAIN_LINKS = [
  { href: '/app', i18nKey: 'projects' as const, icon: FolderOpen, exact: true },
  { href: '/app/settings', i18nKey: 'settings' as const, icon: Settings },
];

const ADMIN_LINKS = [
  { href: '/admin', i18nKey: 'users' as const, icon: Users },
];

const PROJECT_MAIN_LINKS = [
  { segment: 'overview', i18nKey: 'overview' as const, icon: BarChart2 },
  { segment: 'queries', i18nKey: 'queries' as const, icon: Search },
  { segment: 'contents', i18nKey: 'contents' as const, icon: FileText },
  { segment: 'opportunities', i18nKey: 'opportunityMap' as const, icon: Map },
  { segment: 'competitors', i18nKey: 'competitors' as const, icon: Users },
  { segment: 'optimization', i18nKey: 'optimizationTips' as const, icon: Lightbulb },
  { segment: 'agent', i18nKey: 'geoExpert' as const, icon: Bot },
];

const PROJECT_BOTTOM_LINKS = [
  { segment: 'settings', i18nKey: 'settings' as const, icon: Settings },
];

function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
          : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
      )}
    >
      <Icon className="size-4 shrink-0" />
      {label}
    </Link>
  );
}

export function AppSidebar({ isSuperadmin = false }: AppSidebarProps) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const project = useProject();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      {project ? (
        // ── Project nav ──────────────────────────────────────────────
        <>
          <div className="border-b border-zinc-200 px-3 py-3 dark:border-zinc-800">
            <Link
              href="/app"
              className="mb-2 flex items-center gap-1 text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              <ChevronLeft className="size-3.5" />
              {t('projects')}
            </Link>
            {project.brandName && (
              <p className="text-xs font-semibold text-zinc-500">{project.brandName}</p>
            )}
            <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {project.name}
            </p>
          </div>

          <nav className="flex flex-1 flex-col gap-1 p-3">
            {PROJECT_MAIN_LINKS.map(({ segment, i18nKey, icon: Icon }) => {
              const href = `/app/projects/${project.id}/${segment}`;
              const active = pathname === href || pathname.startsWith(href + '/');
              return (
                <NavLink key={href} href={href} label={t(i18nKey)} icon={Icon} active={active} />
              );
            })}
          </nav>

          <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
            {PROJECT_BOTTOM_LINKS.map(({ segment, i18nKey, icon: Icon }) => {
              const href = `/app/projects/${project.id}/${segment}`;
              const active = pathname === href || pathname.startsWith(href + '/');
              return (
                <NavLink key={href} href={href} label={t(i18nKey)} icon={Icon} active={active} />
              );
            })}
          </div>
        </>
      ) : (
        // ── Main nav ─────────────────────────────────────────────────
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {MAIN_LINKS.map(({ href, i18nKey, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <NavLink key={href} href={href} label={t(i18nKey)} icon={Icon} active={active} />
            );
          })}

          {isSuperadmin && (
            <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Admin
              </p>
              {ADMIN_LINKS.map(({ href, i18nKey, icon: Icon }) => {
                const active = pathname.startsWith(href);
                return (
                  <NavLink key={href} href={href} label={t(i18nKey)} icon={Icon} active={active} />
                );
              })}
            </div>
          )}
        </nav>
      )}
    </aside>
  );
}
