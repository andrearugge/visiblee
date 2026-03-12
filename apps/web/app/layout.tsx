import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import localFont from 'next/font/local';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { SessionProvider } from 'next-auth/react';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// Brand font — swap `src` entries once you provide the font files in /public/fonts/
// Expected files: BrandFont-Regular.woff2, BrandFont-Bold.woff2
// const brandFont = localFont({
//   src: [
//     { path: '../public/fonts/BrandFont-Regular.woff2', weight: '400', style: 'normal' },
//     { path: '../public/fonts/BrandFont-Bold.woff2',    weight: '700', style: 'normal' },
//   ],
//   variable: '--font-brand-local',
//   display: 'swap',
// });

export const metadata: Metadata = {
  title: 'Visiblee',
  description: 'AI Visibility Platform',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        <SessionProvider>
          <NextIntlClientProvider locale={locale} messages={messages}>
            {children}
          </NextIntlClientProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
