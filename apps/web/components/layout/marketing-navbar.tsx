'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

export function MarketingNavbar() {
  const t = useTranslations('nav');

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-black/80">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-bold tracking-tight">
          Visiblee
        </Link>
        <div className="flex items-center gap-6 text-sm">
          <Link href="/pricing" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
            {t('pricing')}
          </Link>
          <Link href="/about" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
            {t('about')}
          </Link>
          <Link href="/login" className="rounded-md bg-zinc-900 px-3 py-1.5 text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200">
            {t('login')}
          </Link>
        </div>
      </nav>
    </header>
  );
}
