'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

export function MarketingNavbar() {
  const t = useTranslations('nav');

  return (
    <>
      {/* ── Desktop: floating pill centered (md+) ── */}
      <header className="fixed left-1/2 top-7 z-50 hidden -translate-x-1/2 md:block">
        <div className="flex h-[52px] items-center gap-1 overflow-hidden rounded-[26px] bg-zinc-950 pl-3.5 pr-3 shadow-lg shadow-black/20">

          <Link href="/" className="mr-1 shrink-0 text-white" aria-label="Visiblee">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="14" cy="14" r="11" stroke="currentColor" strokeWidth="2.5" />
              <circle cx="14" cy="14" r="4.5" fill="currentColor" />
            </svg>
          </Link>

          <nav className="flex flex-1 items-center">
            <Link href="/pricing" className="px-2.5 py-1 text-sm font-medium text-zinc-400 transition-colors hover:text-white">
              {t('pricing')}
            </Link>
            <Link href="/about" className="px-2.5 py-1 text-sm font-medium text-zinc-400 transition-colors hover:text-white">
              {t('about')}
            </Link>
          </nav>

          <Link href="/login" className="px-2.5 py-1 text-sm font-medium text-zinc-400 transition-colors hover:text-white">
            {t('login')}
          </Link>
          <Link href="/register" className="ml-1 rounded-full bg-amber-500 px-3.5 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:scale-95">
            {t('register')}
          </Link>

        </div>
      </header>

      {/* ── Mobile: floating pill full-width with margins (< md) ── */}
      <header className="fixed left-4 right-4 top-4 z-50 md:hidden">
        <div className="flex h-[52px] items-center justify-between overflow-hidden rounded-[26px] bg-zinc-950 pl-4 pr-3 shadow-lg shadow-black/20">

          <Link href="/" className="shrink-0 text-white" aria-label="Visiblee">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="14" cy="14" r="11" stroke="currentColor" strokeWidth="2.5" />
              <circle cx="14" cy="14" r="4.5" fill="currentColor" />
            </svg>
          </Link>

          <div className="flex items-center gap-2">
            <Link href="/login" className="px-2 py-1 text-sm font-medium text-zinc-400 transition-colors hover:text-white">
              {t('login')}
            </Link>
            <Link href="/register" className="rounded-full bg-amber-500 px-3 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:scale-95">
              {t('register')}
            </Link>
            {/* Hamburger */}
            <button
              type="button"
              className="flex size-8 items-center justify-center text-zinc-400 transition-colors hover:text-white"
              aria-label="Open menu"
            >
              <svg width="18" height="18" fill="none" viewBox="0 0 16 16">
                <line x1="1" x2="15" y1="4" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="1" x2="15" y1="8" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="1" x2="15" y1="12" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

        </div>
      </header>
    </>
  );
}
