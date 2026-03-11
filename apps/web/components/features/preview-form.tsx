'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { sendGAEvent } from '@/lib/analytics';
import { ArrowRight, Loader2 } from 'lucide-react';

export function PreviewForm() {
  const t = useTranslations('landing');
  const router = useRouter();

  const [websiteUrl, setWebsiteUrl] = useState('');
  const [brandName, setBrandName] = useState('');
  const [queries, setQueries] = useState(['', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);

  function handleFirstTouch() {
    if (!touched) {
      setTouched(true);
      sendGAEvent('form_start', { form_name: 'preview_analysis' });
    }
  }

  function updateQuery(index: number, value: string) {
    setQueries((prev) => prev.map((q, i) => (i === index ? value : q)));
  }

  function validate(): string | null {
    try {
      new URL(websiteUrl);
    } catch {
      return t('formUrlError');
    }
    if (!brandName.trim()) return t('formBrandError');
    if (!queries.some((q) => q.trim())) return t('formQueryError');
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/preview/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          websiteUrl,
          brandName,
          queryTargets: queries.filter((q) => q.trim()),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(t('formError'));
        setLoading(false);
        return;
      }

      sendGAEvent('analysis_requested', {
        brand_name: brandName,
        query_count: queries.filter((q) => q.trim()).length,
      });

      router.push(`/preview/${data.previewId}`);
    } catch {
      setError(t('formError'));
      setLoading(false);
    }
  }

  const queryPlaceholders = [
    t('formQuery1Placeholder'),
    t('formQuery2Placeholder'),
    t('formQuery3Placeholder'),
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="websiteUrl" className="text-sm font-medium">
            {t('formWebsiteUrl')}
          </Label>
          <Input
            id="websiteUrl"
            type="url"
            placeholder={t('formWebsiteUrlPlaceholder')}
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            onFocus={handleFirstTouch}
            required
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="brandName" className="text-sm font-medium">
            {t('formBrandName')}
          </Label>
          <Input
            id="brandName"
            type="text"
            placeholder={t('formBrandNamePlaceholder')}
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            onFocus={handleFirstTouch}
            required
            className="h-11"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">{t('formQueriesLabel')}</Label>
        <div className="space-y-2">
          {queries.map((q, i) => (
            <Input
              key={i}
              type="text"
              placeholder={queryPlaceholders[i]}
              value={q}
              onChange={(e) => updateQuery(i, e.target.value)}
              onFocus={handleFirstTouch}
              className="h-11"
            />
          ))}
        </div>
      </div>

      {error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : null}

      <Button
        type="submit"
        disabled={loading}
        className="h-12 w-full gap-2 text-base font-semibold"
      >
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            {t('formSubmitting')}
          </>
        ) : (
          <>
            {t('formSubmit')}
            <ArrowRight className="size-4" />
          </>
        )}
      </Button>
    </form>
  );
}
