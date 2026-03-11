'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

export function MarketingFooter() {
  const t = useTranslations('footer');
  const router = useRouter();

  function setLocale(locale: string) {
    document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000; SameSite=lax`;
    router.refresh();
  }

  return (
    <footer className="border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-zinc-500 sm:flex-row">
        <div className="flex items-center gap-4">
          <span>© {new Date().getFullYear()} Visiblee. {t('allRightsReserved')}</span>
          <Link href="/privacy" className="hover:text-zinc-900 dark:hover:text-zinc-100">
            {t('privacy')}
          </Link>
          <Link href="/terms" className="hover:text-zinc-900 dark:hover:text-zinc-100">
            {t('terms')}
          </Link>
        </div>

        {/* Language selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide">{t('language')}:</span>
          <button
            onClick={() => setLocale('it')}
            className="rounded px-2 py-0.5 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            IT
          </button>
          <span className="text-zinc-300 dark:text-zinc-700">|</span>
          <button
            onClick={() => setLocale('en')}
            className="rounded px-2 py-0.5 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            EN
          </button>
        </div>
      </div>
    </footer>
  );
}
