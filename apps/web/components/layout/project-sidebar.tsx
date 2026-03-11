'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  BarChart2,
  Search,
  FileText,
  Map,
  Users,
  Lightbulb,
  Bot,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProjectSidebarProps {
  projectId: string;
  projectName?: string;
  brandName?: string;
}

const MAIN_LINK_DEFS = [
  { segment: 'overview', i18nKey: 'overview' as const, icon: BarChart2 },
  { segment: 'queries', i18nKey: 'queries' as const, icon: Search },
  { segment: 'contents', i18nKey: 'contents' as const, icon: FileText },
  { segment: 'opportunities', i18nKey: 'opportunityMap' as const, icon: Map },
  { segment: 'competitors', i18nKey: 'competitors' as const, icon: Users },
  { segment: 'optimization', i18nKey: 'optimizationTips' as const, icon: Lightbulb },
  { segment: 'agent', i18nKey: 'geoExpert' as const, icon: Bot },
];

const BOTTOM_LINK_DEFS = [
  { segment: 'settings', i18nKey: 'settings' as const, icon: Settings },
];

export function ProjectSidebar({ projectId, projectName, brandName }: ProjectSidebarProps) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const base = `/app/projects/${projectId}`;

  function NavLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: React.ElementType; active: boolean }) {
    return (
      <Link
        href={href}
        className={cn(
          'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          active
            ? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
            : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
        )}
      >
        <Icon className="size-4 shrink-0" />
        {label}
      </Link>
    );
  }

  return (
    <aside className="flex w-56 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      {(projectName || brandName) ? (
        <div className="border-b border-zinc-200 px-3 py-3 dark:border-zinc-800">
          {brandName ? <p className="text-xs font-semibold text-zinc-500">{brandName}</p> : null}
          {projectName ? <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{projectName}</p> : null}
        </div>
      ) : null}
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {MAIN_LINK_DEFS.map(({ segment, i18nKey, icon: Icon }) => {
          const href = `${base}/${segment}`;
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <NavLink key={href} href={href} label={t(i18nKey)} icon={Icon} active={active} />
          );
        })}
      </nav>
      <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
        {BOTTOM_LINK_DEFS.map(({ segment, i18nKey, icon: Icon }) => {
          const href = `${base}/${segment}`;
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <NavLink key={href} href={href} label={t(i18nKey)} icon={Icon} active={active} />
          );
        })}
      </div>
    </aside>
  );
}
