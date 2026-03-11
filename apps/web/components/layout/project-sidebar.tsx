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
}

export function ProjectSidebar({ projectId }: ProjectSidebarProps) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const base = `/app/projects/${projectId}`;

  const mainLinks = [
    { href: `${base}/overview`, label: t('overview'), icon: BarChart2 },
    { href: `${base}/queries`, label: t('queries'), icon: Search },
    { href: `${base}/contents`, label: t('contents'), icon: FileText },
    { href: `${base}/opportunities`, label: t('opportunityMap'), icon: Map },
    { href: `${base}/competitors`, label: t('competitors'), icon: Users },
    { href: `${base}/optimization`, label: t('optimizationTips'), icon: Lightbulb },
    { href: `${base}/agent`, label: t('geoExpert'), icon: Bot },
  ];

  const bottomLinks = [
    { href: `${base}/settings`, label: t('settings'), icon: Settings },
  ];

  function NavLink({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) {
    const active = pathname === href || pathname.startsWith(href + '/');
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
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {mainLinks.map((link) => (
          <NavLink key={link.href} {...link} />
        ))}
      </nav>
      <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
        {bottomLinks.map((link) => (
          <NavLink key={link.href} {...link} />
        ))}
      </div>
    </aside>
  );
}
