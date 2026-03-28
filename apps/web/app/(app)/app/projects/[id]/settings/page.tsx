import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { ProjectSettingsForm } from '@/components/features/project-settings-form';
import { GscConnectionCard } from '@/components/gsc/gsc-connection-card';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ gsc?: string }>;
}

export default async function ProjectSettingsPage({ params, searchParams }: Props) {
  const [session, { id }, t] = await Promise.all([auth(), params, getTranslations('projects')]);

  const project = await db.project.findFirst({
    where: { id, userId: session!.user.id },
  });

  if (!project) notFound();

  const [gscConnection, pendingJob] = await Promise.all([
    db.gscConnection.findUnique({
      where: { projectId: id },
      select: {
        status: true,
        propertyUrl: true,
        lastSyncAt: true,
      },
    }),
    db.job.findFirst({
      where: { projectId: id, type: 'gsc_sync', status: { in: ['pending', 'running'] } },
      select: { id: true },
    }),
  ]);

  const [queryCount, profileCount] = await Promise.all([
    gscConnection
      ? db.gscQueryData.count({ where: { projectId: id } })
      : Promise.resolve(0),
    gscConnection
      ? db.intentProfile.count({ where: { projectId: id, isActive: true } })
      : Promise.resolve(0),
  ]);

  const gscStatus = gscConnection
    ? {
        connected: gscConnection.status === 'active',
        status: gscConnection.status,
        propertyUrl: gscConnection.propertyUrl,
        lastSyncAt: gscConnection.lastSyncAt?.toISOString() ?? null,
        pendingJobId: pendingJob?.id ?? null,
        queryCount,
        profileCount,
      }
    : null;

  return (
    <div className="mx-auto max-w-xl space-y-6 p-6">
      <h1 className="text-xl font-semibold">{t('settings')}</h1>
      <ProjectSettingsForm project={project} />

      {process.env.NEXT_PUBLIC_GSC_ENABLED === 'true' && (
        <GscConnectionCard
          projectId={id}
          websiteUrl={project.websiteUrl}
          initialStatus={gscStatus}
        />
      )}
    </div>
  );
}
