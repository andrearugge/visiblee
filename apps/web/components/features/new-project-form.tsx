'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect, type SelectOption } from '@/components/ui/searchable-select';

const LANGUAGE_OPTIONS: SelectOption[] = [
  { value: 'it', label: 'Italiano' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'pt', label: 'Português' },
];

const COUNTRY_OPTIONS: SelectOption[] = [
  { value: 'IT', label: 'Italy' },
  { value: 'US', label: 'United States' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'ES', label: 'Spain' },
  { value: 'MX', label: 'Mexico' },
  { value: 'AR', label: 'Argentina' },
  { value: 'CO', label: 'Colombia' },
  { value: 'CL', label: 'Chile' },
  { value: 'PE', label: 'Peru' },
  { value: 'FR', label: 'France' },
  { value: 'BE', label: 'Belgium' },
  { value: 'CH', label: 'Switzerland' },
  { value: 'CA', label: 'Canada' },
  { value: 'DE', label: 'Germany' },
  { value: 'AT', label: 'Austria' },
  { value: 'PT', label: 'Portugal' },
  { value: 'BR', label: 'Brazil' },
  { value: 'AU', label: 'Australia' },
  { value: 'IN', label: 'India' },
  { value: 'NL', label: 'Netherlands' },
  { value: 'SE', label: 'Sweden' },
  { value: 'NO', label: 'Norway' },
  { value: 'DK', label: 'Denmark' },
  { value: 'FI', label: 'Finland' },
  { value: 'PL', label: 'Poland' },
  { value: 'IE', label: 'Ireland' },
  { value: 'NZ', label: 'New Zealand' },
  { value: 'ZA', label: 'South Africa' },
  { value: 'SG', label: 'Singapore' },
  { value: 'AE', label: 'United Arab Emirates' },
  { value: 'JP', label: 'Japan' },
  { value: 'KR', label: 'South Korea' },
];

export function NewProjectForm() {
  const t = useTranslations('projects');
  const router = useRouter();

  const [name, setName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [description, setDescription] = useState('');
  const [queriesText, setQueriesText] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('it');
  const [targetCountry, setTargetCountry] = useState('IT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const queryTargets = queriesText
      .split('\n')
      .map((q) => q.trim())
      .filter(Boolean);

    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, brandName, websiteUrl, description, queryTargets, targetLanguage, targetCountry }),
    });

    setLoading(false);

    if (!res.ok) {
      try {
        const data = await res.json();
        setError(data.error ?? 'Error');
      } catch {
        setError('Error');
      }
      return;
    }

    const project = await res.json();
    router.push(`/app/projects/${project.id}/overview`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="brandName">{t('brandName')}</Label>
        <Input
          id="brandName"
          value={brandName}
          onChange={(e) => setBrandName(e.target.value)}
          placeholder={t('brandNamePlaceholder')}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="name">{t('websiteName')}</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('namePlaceholder')}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="websiteUrl">{t('websiteUrl')}</Label>
        <Input
          id="websiteUrl"
          type="url"
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          placeholder={t('urlPlaceholder')}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>{t('targetLanguage')}</Label>
          <SearchableSelect
            options={LANGUAGE_OPTIONS}
            value={targetLanguage}
            onChange={setTargetLanguage}
            placeholder={t('selectLanguage')}
            searchPlaceholder={t('searchLanguage')}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t('targetCountry')}</Label>
          <SearchableSelect
            options={COUNTRY_OPTIONS}
            value={targetCountry}
            onChange={setTargetCountry}
            placeholder={t('selectCountry')}
            searchPlaceholder={t('searchCountry')}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">{t('description')}</Label>
        <Input
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('descriptionPlaceholder')}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="queries">{t('targetQueries')}</Label>
        <p className="text-xs text-zinc-500">{t('queriesHint')}</p>
        <textarea
          id="queries"
          value={queriesText}
          onChange={(e) => setQueriesText(e.target.value)}
          placeholder={t('queriesPlaceholder')}
          rows={4}
          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-800 dark:bg-zinc-950"
        />
      </div>

      {error ? <p className="text-sm text-red-500">{error}</p> : null}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? t('creating') : t('create')}
      </Button>
    </form>
  );
}
