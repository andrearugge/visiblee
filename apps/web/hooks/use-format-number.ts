'use client';

import { useLocale } from 'next-intl';
import { formatNumber, formatCompact } from '@/lib/format';

/**
 * Locale-aware number formatting for client components.
 * Reads the current locale from next-intl and applies the correct
 * thousands/decimal conventions (IT: 1.234,5 — EN: 1,234.5).
 *
 * For server components, import formatNumber/formatCompact from '@/lib/format'
 * and pass the locale from getLocale() or the request config.
 */
export function useFormatNumber() {
  const locale = useLocale();
  return {
    format: (value: number) => formatNumber(value, locale),
    compact: (value: number) => formatCompact(value, locale),
  };
}
