/**
 * Number formatting utilities.
 *
 * Italian convention (default): dot for thousands, comma for decimals → 1.234,56
 * English convention:           comma for thousands, dot for decimals → 1,234.56
 *
 * Pass the next-intl locale string ('it' | 'en') to get locale-appropriate formatting.
 * Uses a regex-based implementation to avoid ICU data availability issues in Node.js.
 */

function isItalian(locale?: string): boolean {
  if (!locale) return true; // default to Italian
  return locale === 'it' || locale.startsWith('it-');
}

/**
 * Format a number with thousands separators.
 * Decimal places are shown only when the value is not a whole number (max 2 significant decimal digits).
 *
 * @example
 * formatNumber(1000)        → "1.000"  (it) / "1,000"  (en)
 * formatNumber(2249)        → "2.249"  (it) / "2,249"  (en)
 * formatNumber(1234.5)      → "1.234,5" (it) / "1,234.5" (en)
 * formatNumber(0.75, 'en')  → "0.75"
 */
export function formatNumber(value: number, locale?: string): string {
  const it = isItalian(locale);
  const thousandsSep = it ? '.' : ',';
  const decimalSep = it ? ',' : '.';

  const isInteger = Number.isInteger(value);
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (isInteger) {
    const intStr = Math.round(abs).toString();
    return sign + intStr.replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSep);
  }

  // Non-integer: show up to 2 decimal places, strip trailing zeros
  const fixed = abs.toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const trimmedDec = decPart.replace(/0+$/, '');
  const groupedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSep);

  if (!trimmedDec) return sign + groupedInt;
  return sign + groupedInt + decimalSep + trimmedDec;
}

/**
 * Format a number in compact notation for space-constrained UI elements.
 * Uses the same locale conventions as formatNumber.
 *
 * @example
 * formatCompact(1500)           → "1,5k"  (it) / "1.5k"  (en)
 * formatCompact(1_200_000)      → "1,2M"
 * formatCompact(2_500_000_000)  → "2,5B"
 * formatCompact(999)            → "999"
 */
export function formatCompact(value: number, locale?: string): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (abs >= 1_000_000_000) {
    return sign + formatNumber(abs / 1_000_000_000, locale) + 'B';
  }
  if (abs >= 1_000_000) {
    return sign + formatNumber(abs / 1_000_000, locale) + 'M';
  }
  if (abs >= 1_000) {
    return sign + formatNumber(abs / 1_000, locale) + 'k';
  }
  return sign + formatNumber(abs, locale);
}
