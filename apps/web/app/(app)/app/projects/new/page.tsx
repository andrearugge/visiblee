import { getTranslations } from 'next-intl/server';
import { NewProjectForm } from '@/components/features/new-project-form';

export default async function NewProjectPage() {
  const t = await getTranslations('projects');

  return (
    <div className="mx-auto max-w-xl p-6">
      <h1 className="mb-6 text-xl font-semibold">{t('newProject')}</h1>
      <NewProjectForm />
    </div>
  );
}
