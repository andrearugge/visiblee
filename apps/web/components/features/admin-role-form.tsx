'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

interface Props {
  userId: string;
  currentRole: string;
}

const ROLES = ['user', 'admin', 'superadmin'] as const;

export function AdminRoleForm({ userId, currentRole }: Props) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [role, setRole] = useState(currentRole);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  async function handleSave() {
    setSaving(true);
    setMsg('');

    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });

    setSaving(false);

    if (res.ok) {
      setMsg(t('roleSaved'));
      router.refresh();
    } else {
      setMsg(t('roleError'));
    }
  }

  return (
    <div className="flex items-center gap-3">
      <select
        value={role}
        onChange={(e) => setRole(e.target.value)}
        className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
      <Button size="sm" onClick={handleSave} disabled={saving || role === currentRole}>
        {saving ? t('saving') : t('saveRole')}
      </Button>
      {msg && <span className="text-sm text-zinc-500">{msg}</span>}
    </div>
  );
}
