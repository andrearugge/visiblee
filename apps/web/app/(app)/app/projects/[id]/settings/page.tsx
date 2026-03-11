import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { ProjectSettingsForm } from '@/components/features/project-settings-form';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProjectSettingsPage({ params }: Props) {
  const session = await auth();
  const { id } = await params;
  const t = await getTranslations('projects');

  const project = await db.project.findFirst({
    where: { id, userId: session!.user.id },
  });

  if (!project) notFound();

  return (
    <div className="mx-auto max-w-xl p-6">
      <h1 className="mb-6 text-xl font-semibold">{t('settings')}</h1>
      <ProjectSettingsForm project={project} />
    </div>
  );
}
