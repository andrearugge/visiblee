import { getTranslations } from 'next-intl/server';
import { Sparkles } from 'lucide-react';

export default async function QueryCitationsPage() {
  const [tn, tc] = await Promise.all([getTranslations('nav'), getTranslations('common')]);
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50">
        <Sparkles className="size-5 text-zinc-400" />
      </div>
      <p className="text-sm font-semibold text-zinc-700">{tn('queryCitations')}</p>
      <p className="mt-1 text-xs text-zinc-400">{tc('comingSoon')}</p>
    </div>
  );
}
