import { getTranslations } from 'next-intl/server';
import { ChevronsDown } from 'lucide-react';
import Link from 'next/link';
import { PreviewForm } from '@/components/features/preview-form';
import { buttonVariants } from '@/lib/button-variants';
import { cn } from '@/lib/utils';

const PLATFORMS = ['ChatGPT', 'Perplexity', 'Google AI Mode', 'Gemini', 'Claude', 'Copilot'];

const HOW_IT_WORKS_STEPS = [
  { key: 'step1', num: '01' },
  { key: 'step2', num: '02' },
  { key: 'step3', num: '03' },
] as const;

const MOCK_SCORES = [
  { label: 'Query Reach', value: 0.72, color: '#22c55e' },
  { label: 'Answer Strength', value: 0.58, color: '#f59e0b' },
  { label: 'Extractability', value: 0.81, color: '#22c55e' },
  { label: 'Brand Trust', value: 0.34, color: '#ef4444' },
  { label: 'Source Authority', value: 0.47, color: '#f59e0b' },
];

// Add your client/partner logos to /public/marketing/brands/
// Each entry: { name, href, src, width, height }
const BRANDS: { name: string; href: string; src: string; height: number }[] = [
  { name: 'Acme', href: 'https://acme.com', src: '/marketing/brands/logo.png', height: 24 },
  { name: 'Acme', href: 'https://acme.com', src: '/marketing/brands/logo.png', height: 24 },
  { name: 'Acme', href: 'https://acme.com', src: '/marketing/brands/logo.png', height: 24 },
  { name: 'Acme', href: 'https://acme.com', src: '/marketing/brands/logo.png', height: 24 }
];

// Anti-corner gradient — fills the gap between the hanging pill and the section edge.
// color must match the bg of the pill container (white).
const ANTI_CORNER_L = 'radial-gradient(circle at 0% 100%, transparent 32px, white 32.5px)';
const ANTI_CORNER_R = 'radial-gradient(circle at 100% 100%, transparent 32px, white 32.5px)';

// Bottom pill anti-corners — color must match the bg of the section below (#f4f4f5 = zinc-100, but platforms uses zinc-50 = #fafafa)
const ANTI_CORNER_B_L = 'radial-gradient(circle at 0% 0%, transparent 32px, #fafafa 32.5px)';
const ANTI_CORNER_B_R = 'radial-gradient(circle at 100% 0%, transparent 32px, #fafafa 32.5px)';

export default async function LandingPage() {
  const t = await getTranslations('landing');

  return (
    <div className="bg-white">

      {/* ── Hero text ── */}
      <section className="px-4 pb-10 pt-24 text-center md:pt-32">
        <div className="mx-auto max-w-3xl">
          <h1 className="mb-5 text-balance text-5xl font-bold tracking-tight text-zinc-950">
            {t('heroTitle')}
          </h1>
          <p className="mx-auto max-w-xl text-balance text-lg leading-relaxed text-zinc-500">
            {t('heroSubtitle')}
          </p>
        </div>
      </section>

      {/* ── Brand logo strip ── */}
      {BRANDS.length > 0 && (
        <div className="mx-auto max-w-3xl px-5 pb-10">
          <p className="mb-4 text-center text-xs font-medium text-zinc-400">{t('trustedBy')}</p>
          <div className="flex flex-wrap items-center justify-center gap-y-6">
            {BRANDS.map(({ name, href, src, height }) => (
              <a
                key={name}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="group shrink-0 px-4"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={name}
                  src={src}
                  height={height}
                  className="w-auto opacity-40 transition-opacity group-hover:opacity-100"
                  style={{ height }}
                />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ── Form section — background image with hanging badge ── */}
      <section
        id="analysis-form"
        className="relative w-full py-8 pt-20 md:py-20 md:pt-28"
        style={{
          backgroundImage: 'url(/marketing/bg-hero.webp)',
          backgroundSize: 'cover',
          backgroundPosition: 'center center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* Grid overlay — above bg image, below content */}
        <div className="grid-pattern absolute inset-0 z-20" />

        {/* Hanging badge — sits at top-0, overlaps hero section above */}
        <div className="absolute left-1/2 top-0 z-30 flex h-[52px] -translate-x-1/2 items-center rounded-b-[2rem] bg-white px-8">
          {/* Anti-corner left */}
          <div
            className="absolute left-[-31px] top-0 h-8 w-8"
            style={{ background: ANTI_CORNER_L }}
          />

          <div
            className="inline-flex items-center gap-2 rounded-full bg-amber-50 py-1.5 pl-1.5 pr-2.5 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-100"
          >
            <span className="flex h-5 items-center justify-center rounded-full bg-gradient-to-r from-amber-500 to-orange-400 px-1.5 text-xs font-semibold uppercase text-white">
              {t('badgeLabel')}
            </span>
            {t('badge')}
            <ChevronsDown className="-ml-1 size-4 opacity-60" />
          </div>

          {/* Anti-corner right */}
          <div
            className="absolute right-[-31px] top-0 h-8 w-8"
            style={{ background: ANTI_CORNER_R }}
          />
        </div>

        {/* Form card */}
        <div className="relative z-30 mx-auto max-w-5xl px-5">
          <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="p-6 sm:p-8">
              <p className="mb-5 text-sm font-semibold text-zinc-900">{t('formTitle')}</p>
              <PreviewForm />
            </div>
          </div>
        </div>

        {/* Bottom hanging pill — rises from bottom, connects to zinc-50 section below */}
        <div className="absolute bottom-0 left-1/2 z-30 flex h-[52px] -translate-x-1/2 items-center rounded-t-[2rem] bg-zinc-50 px-8">
          {/* Anti-corner left */}
          <div
            className="absolute bottom-0 left-[-31px] h-8 w-8"
            style={{ background: ANTI_CORNER_B_L }}
          />

          <div
            className="inline-flex items-center gap-2 rounded-full bg-amber-50 py-1.5 px-4 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-100"
          >
            {t('trustNote')}
          </div>

          {/* Anti-corner right */}
          <div
            className="absolute bottom-0 right-[-31px] h-8 w-8"
            style={{ background: ANTI_CORNER_B_R }}
          />
        </div>
      </section>

      {/* ── Platforms ── */}
      <section className="bg-zinc-50 px-4 py-10">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-zinc-400">
            {t('platformsTitle')}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {PLATFORMS.map((name) => (
              <span key={name} className="text-sm font-medium text-zinc-400">
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Score preview mockup ── */}
      <section className="border-y border-zinc-100 px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <h2 className="mb-3 text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl">
              {t('previewSectionTitle')}
            </h2>
            <p className="mx-auto max-w-lg text-zinc-500">{t('previewSectionSubtitle')}</p>
          </div>

          <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex items-center gap-1.5 border-b border-zinc-100 bg-zinc-50 px-4 py-3">
              <span className="size-2.5 rounded-full bg-zinc-200" />
              <span className="size-2.5 rounded-full bg-zinc-200" />
              <span className="size-2.5 rounded-full bg-zinc-200" />
              <span className="ml-3 text-xs text-zinc-400">visiblee.ai · Acme Corp</span>
            </div>

            <div className="grid gap-6 p-6 sm:grid-cols-2 sm:p-8">
              <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-100 bg-zinc-50 p-6 text-center">
                <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-zinc-400">
                  AI Readiness Score
                </p>
                <div className="my-3 flex items-end gap-1">
                  <span className="text-7xl font-bold leading-none tracking-tight text-zinc-950">61</span>
                  <span className="mb-2 text-2xl font-medium text-zinc-300">/ 100</span>
                </div>
                <p className="text-xs text-zinc-400">acme.com</p>
              </div>

              <div className="space-y-3.5">
                {MOCK_SCORES.map(({ label, value, color }) => {
                  const pct = Math.round(value * 100);
                  return (
                    <div key={label} className="flex items-center gap-3">
                      <span className="w-32 shrink-0 text-xs font-medium text-zinc-600">{label}</span>
                      <div className="flex-1 overflow-hidden rounded-full bg-zinc-100" style={{ height: 6 }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                      </div>
                      <span className="w-7 shrink-0 text-right text-xs font-semibold tabular-nums text-zinc-800">
                        {pct}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-zinc-100 bg-zinc-50 px-6 py-3 sm:px-8">
              <p className="text-xs text-zinc-400">
                Analyzed by Visiblee · {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="bg-zinc-50 px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <h2 className="mb-3 text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl">
              {t('howItWorksTitle')}
            </h2>
            <p className="text-zinc-500">{t('howItWorksSubtitle')}</p>
          </div>

          <div className="grid gap-px bg-zinc-200 sm:grid-cols-3">
            {HOW_IT_WORKS_STEPS.map(({ key, num }) => (
              <div key={key} className="bg-zinc-50 p-8">
                <span className="mb-6 block text-3xl font-bold text-zinc-200">{num}</span>
                <h3 className="mb-2 text-base font-semibold text-zinc-900">
                  {t(`${key}Title` as 'step1Title' | 'step2Title' | 'step3Title')}
                </h3>
                <p className="text-sm leading-relaxed text-zinc-500">
                  {t(`${key}Description` as 'step1Description' | 'step2Description' | 'step3Description')}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA — dark ── */}
      <section className="bg-zinc-950 px-4 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {t('ctaTitle')}
          </h2>
          <p className="mb-8 text-lg text-zinc-400">{t('ctaSubtitle')}</p>
          <Link
            href="#analysis-form"
            className={cn(
              buttonVariants({ size: 'lg' }),
              'h-12 gap-2 bg-white px-8 text-base font-semibold text-zinc-950 hover:bg-zinc-100',
            )}
          >
            {t('ctaButton')}
          </Link>
        </div>
      </section>

    </div>
  );
}
