'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface Tab {
  href: string;
  label: string;
}

export function QuerySubNav({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-0 border-b border-zinc-200 bg-white px-6">
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(tab.href + '/');
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'border-b-2 px-4 py-3 text-sm font-medium transition-colors',
              active
                ? 'border-zinc-900 text-zinc-900'
                : 'border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
