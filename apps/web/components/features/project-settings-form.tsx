'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface Project {
  id: string;
  name: string;
  brandName: string;
  websiteUrl: string;
  description: string | null;
}

interface Props {
  project: Project;
}

export function ProjectSettingsForm({ project }: Props) {
  const t = useTranslations('projects');
  const tCommon = useTranslations('common');
  const router = useRouter();

  const [name, setName] = useState(project.name);
  const [brandName, setBrandName] = useState(project.brandName);
  const [websiteUrl, setWebsiteUrl] = useState(project.websiteUrl);
  const [description, setDescription] = useState(project.description ?? '');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveMsg('');

    const res = await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, brandName, websiteUrl, description }),
    });

    setSaving(false);

    if (res.ok) {
      setSaveMsg(t('saved'));
      router.refresh();
    } else {
      setSaveMsg(t('saveError'));
    }
  }

  async function handleDelete() {
    setDeleting(true);

    const res = await fetch(`/api/projects/${project.id}`, { method: 'DELETE' });

    setDeleting(false);

    if (res.ok) {
      router.push('/app');
    } else {
      setSaveMsg(t('deleteError'));
      setDeleteOpen(false);
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={handleSave} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="brandName">{t('brandName')}</Label>
          <Input
            id="brandName"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="name">{t('websiteName')}</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
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
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">{t('description')}</Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {saveMsg ? (
          <p className={`text-sm ${saveMsg === t('saved') ? 'text-green-600' : 'text-red-500'}`}>
            {saveMsg}
          </p>
        ) : null}

        <Button type="submit" disabled={saving}>
          {saving ? t('saving') : t('saveChanges')}
        </Button>
      </form>

      {/* Danger zone */}
      <div className="rounded-lg border border-red-200 bg-red-50/50">
        <div className="border-b border-red-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-red-700">Danger zone</h2>
        </div>
        <div className="flex items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-sm font-medium text-zinc-800">{t('deleteProject')}</p>
            <p className="mt-0.5 text-xs text-zinc-500">{t('deleteConfirmDescription')}</p>
          </div>
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger
              className="shrink-0 inline-flex h-8 items-center justify-center rounded-md border border-red-300 bg-white px-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              {t('deleteProject')}
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('deleteConfirmTitle')}</DialogTitle>
                <DialogDescription>{t('deleteConfirmDescription')}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                  {tCommon('cancel')}
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? t('deleting') : t('deleteConfirm')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
