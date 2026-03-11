'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
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

        {saveMsg && (
          <p className={`text-sm ${saveMsg === t('saved') ? 'text-green-600' : 'text-red-500'}`}>
            {saveMsg}
          </p>
        )}

        <Button type="submit" disabled={saving}>
          {saving ? t('saving') : t('saveChanges')}
        </Button>
      </form>

      <Separator />

      <div className="space-y-3">
        <h2 className="text-base font-medium text-red-600">{t('deleteProject')}</h2>
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogTrigger
            className="inline-flex h-9 items-center justify-center rounded-md bg-red-600 px-3 text-sm font-medium text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-600"
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
  );
}
