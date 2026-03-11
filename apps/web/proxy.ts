import { type NextRequest, NextResponse } from 'next/server';
import { locales, defaultLocale } from './i18n/config';

/**
 * Locale detection proxy.
 * Does NOT modify URLs — routes are always prefix-free (/app/..., not /en/app/...).
 * Detects locale from NEXT_LOCALE cookie or Accept-Language header and
 * persists the result in the NEXT_LOCALE cookie for subsequent requests.
 */
export default function proxy(req: NextRequest) {
  const cookieLocale = req.cookies.get('NEXT_LOCALE')?.value;

  // If a valid locale cookie already exists, nothing to do
  if (cookieLocale && (locales as readonly string[]).includes(cookieLocale)) {
    return NextResponse.next();
  }

  // Detect from Accept-Language header
  const acceptLanguage = req.headers.get('accept-language') ?? '';
  const browserLocale =
    acceptLanguage.split(',')[0]?.split('-')[0]?.toLowerCase() ?? '';
  const locale = (locales as readonly string[]).includes(browserLocale)
    ? browserLocale
    : defaultLocale;

  const response = NextResponse.next();
  response.cookies.set('NEXT_LOCALE', locale, { path: '/', sameSite: 'lax' });
  return response;
}

export const config = {
  // Run on all routes except Next.js internals and static assets
  matcher: ['/((?!_next|_vercel|.*\\..*).*)'],
};
