import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { PreviewForm } from '@/components/features/preview-form';
import { buttonVariants } from '@/lib/button-variants';
import { cn } from '@/lib/utils';

const PLATFORMS = ['ChatGPT', 'Perplexity', 'Google AI', 'Gemini', 'Claude', 'Copilot'];

const HOW_IT_WORKS_STEPS = [
  { key: 'step1', icon: '01' },
  { key: 'step2', icon: '02' },
  { key: 'step3', icon: '03' },
] as const;

export default async function LandingPage() {
  const t = await getTranslations('landing');

  return (
    <div className="relative overflow-hidden">
      {/* ── Decorative background blobs ── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="absolute -right-40 -top-40 h-[600px] w-[600px] rounded-full bg-amber-200/30 blur-[120px]" />
        <div className="absolute -left-40 top-1/3 h-[500px] w-[500px] rounded-full bg-orange-100/40 blur-[100px]" />
        <div className="absolute bottom-0 right-1/4 h-[400px] w-[400px] rounded-full bg-yellow-100/30 blur-[80px]" />
      </div>

      {/* ── Hero ── */}
      <section className="px-4 pb-16 pt-20 sm:pt-28">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col items-center text-center">
            {/* Badge */}
            <span className="mb-6 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1 text-xs font-medium tracking-wide text-amber-700">
              {t('badge')}
            </span>

            {/* Headline */}
            <h1 className="mb-5 max-w-2xl text-balance text-5xl font-bold leading-[1.1] tracking-tight text-zinc-900 sm:text-6xl lg:text-7xl">
              {t('heroTitle').split('\n').map((line, i) => (
                <span key={i}>
                  {i > 0 ? <br /> : null}
                  {line}
                </span>
              ))}
            </h1>

            {/* Subtitle */}
            <p className="mb-12 max-w-xl text-balance text-lg leading-relaxed text-zinc-500 sm:text-xl">
              {t('heroSubtitle')}
            </p>

            {/* Form card */}
            <div className="w-full max-w-2xl rounded-2xl border border-zinc-200/80 bg-white/90 p-6 shadow-xl shadow-zinc-100 backdrop-blur-sm sm:p-8">
              <h2 className="mb-6 text-lg font-semibold text-zinc-900">
                {t('formTitle')}
              </h2>
              <PreviewForm />
            </div>

            {/* Trust note */}
            <p className="mt-4 text-sm text-zinc-400">
              {t('ctaSubtitle')}
            </p>
          </div>
        </div>
      </section>

      {/* ── Platforms ── */}
      <section className="border-t border-zinc-100 bg-zinc-50/50 px-4 py-12">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-6 text-sm font-medium uppercase tracking-widest text-zinc-400">
            {t('platformsTitle')}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {PLATFORMS.map((name) => (
              <span
                key={name}
                className="text-base font-semibold text-zinc-400 transition-colors hover:text-zinc-700"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="px-4 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <h2 className="mb-3 text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
              {t('howItWorksTitle')}
            </h2>
            <p className="text-lg text-zinc-500">{t('howItWorksSubtitle')}</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            {HOW_IT_WORKS_STEPS.map(({ key, icon }) => (
              <div
                key={key}
                className="group relative rounded-2xl border border-zinc-200/80 bg-white p-8 transition-shadow hover:shadow-lg"
              >
                <span className="mb-5 block text-4xl font-bold text-amber-200 transition-colors group-hover:text-amber-300">
                  {icon}
                </span>
                <h3 className="mb-2 text-lg font-semibold text-zinc-900">
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

      {/* ── Bottom CTA ── */}
      <section className="relative overflow-hidden border-t border-zinc-100 px-4 py-24">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10"
        >
          <div className="absolute left-1/2 top-0 h-[400px] w-[800px] -translate-x-1/2 rounded-full bg-amber-100/40 blur-[100px]" />
        </div>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-3 text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            {t('ctaTitle')}
          </h2>
          <p className="mb-8 text-lg text-zinc-500">{t('ctaSubtitle')}</p>
          <Link
            href="#"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={cn(
              buttonVariants({ size: 'lg' }),
              'h-12 gap-2 px-8 text-base font-semibold',
            )}
          >
            {t('ctaButton')}
          </Link>
        </div>
      </section>
    </div>
  );
}
