'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronRight, User, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CitationVariant {
  profileName: string;
  profileSlug: string;
  intentProfileId: string;
  userCited: boolean;
  userCitedPosition: number | null;
}

interface CitationVariantsPanelProps {
  variants: CitationVariant[];
}

export function CitationVariantsPanel({ variants }: CitationVariantsPanelProps) {
  const t = useTranslations('gsc.variants');
  const [open, setOpen] = useState(false);

  if (variants.length === 0) return null;

  return (
    <div className="mt-3 border-t border-zinc-100 pt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-700"
      >
        {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        {t('title')}
      </button>

      {open && (
        <div className="mt-2 space-y-1.5">
          {variants.map((v) => (
            <div
              key={v.profileSlug}
              className={cn(
                'flex items-center justify-between rounded-lg border px-3 py-2',
                v.userCited
                  ? 'border-green-100 bg-green-50/40'
                  : 'border-zinc-100 bg-zinc-50/60',
              )}
            >
              <div className="flex items-center gap-2">
                <User className="size-3.5 shrink-0 text-zinc-400" />
                <span className="text-xs font-medium text-zinc-700">{v.profileName}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {v.userCited ? (
                  <>
                    <CheckCircle2 className="size-3.5 text-green-500" />
                    <span className="text-xs text-green-700">{t('cited')}</span>
                    {v.userCitedPosition != null && (
                      <span className="text-xs text-green-600">
                        {t('position', { position: v.userCitedPosition })}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <XCircle className="size-3.5 text-zinc-300" />
                    <span className="text-xs text-zinc-400">{t('notCited')}</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
