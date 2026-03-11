import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { defaultLocale, locales, type Locale } from './config';

/**
 * Resolves the user's locale from:
 * 1. NEXT_LOCALE cookie (set by middleware or language selector)
 * 2. Accept-Language request header (browser preference)
 * 3. Default locale ('en')
 */
async function resolveLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;

  if (cookieLocale && (locales as readonly string[]).includes(cookieLocale)) {
    return cookieLocale as Locale;
  }

  const headersList = await headers();
  const acceptLanguage = headersList.get('accept-language') ?? '';
  const browserLocale = acceptLanguage.split(',')[0]?.split('-')[0]?.toLowerCase();

  if (browserLocale && (locales as readonly string[]).includes(browserLocale)) {
    return browserLocale as Locale;
  }

  return defaultLocale;
}

export default getRequestConfig(async ({ requestLocale }) => {
  // requestLocale comes from middleware (URL segment); since we use no URL
  // prefixes it will typically be undefined — fall back to cookie/header.
  const segmentLocale = await requestLocale;
  const isValidSegment =
    segmentLocale !== undefined &&
    (locales as readonly string[]).includes(segmentLocale);

  const locale: Locale = isValidSegment
    ? (segmentLocale as Locale)
    : await resolveLocale();

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
