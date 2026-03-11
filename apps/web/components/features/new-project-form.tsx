'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function NewProjectForm() {
  const t = useTranslations('projects');
  const router = useRouter();

  const [name, setName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [description, setDescription] = useState('');
  const [queriesText, setQueriesText] = useState('');
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
      body: JSON.stringify({ name, brandName, websiteUrl, description, queryTargets }),
    });

    setLoading(false);

    if (!res.ok) {
      setError((await res.json()).error ?? 'Error');
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

      {error && <p className="text-sm text-red-500">{error}</p>}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? t('creating') : t('create')}
      </Button>
    </form>
  );
}
