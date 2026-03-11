'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

interface Props {
  name: string;
  email: string;
  preferredLocale: string;
  provider: string;
}

export function UserSettingsForm({ name: initialName, email, preferredLocale: initialLocale, provider }: Props) {
  const t = useTranslations('settings');
  const router = useRouter();

  const [name, setName] = useState(initialName);
  const [locale, setLocale] = useState(initialLocale);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg('');

    const res = await fetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, preferredLocale: locale }),
    });

    setSaving(false);

    if (res.ok) {
      setMsg(t('saved'));

      // Update locale cookie and refresh
      document.cookie = `NEXT_LOCALE=${locale}; path=/; samesite=lax`;
      router.refresh();
    } else {
      setMsg(t('saveError'));
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">{t('name')}</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">{t('email')}</Label>
          <Input id="email" value={email} readOnly className="bg-zinc-50 dark:bg-zinc-900" />
          <p className="text-xs text-zinc-400">{t('emailReadOnly')}</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="locale">{t('language')}</Label>
          <select
            id="locale"
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <option value="en">{t('english')}</option>
            <option value="it">{t('italian')}</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <Label>{t('authProvider')}</Label>
          <p className="text-sm text-zinc-500">
            {provider === 'google' ? t('providerGoogle') : t('providerCredentials')}
          </p>
        </div>
      </div>

      {provider === 'credentials' && (
        <>
          <Separator />
          <div className="space-y-1.5">
            <h3 className="text-sm font-medium">{t('changePassword')}</h3>
            <p className="text-sm text-zinc-400">{t('changePasswordComingSoon')}</p>
          </div>
        </>
      )}

      {msg && (
        <p className={`text-sm ${msg === t('saved') ? 'text-green-600' : 'text-red-500'}`}>
          {msg}
        </p>
      )}

      <Button type="submit" disabled={saving}>
        {saving ? t('saving') : t('saveChanges')}
      </Button>
    </form>
  );
}
