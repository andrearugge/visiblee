import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard';
import { SetupBanner } from '@/components/features/setup-banner';

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const [session, { id }] = await Promise.all([auth(), params]);

  const project = await db.project.findFirst({
    where: { id, userId: session!.user.id },
    select: { id: true },
  });

  if (!project) notFound();

  return (
    <>
      <OnboardingWizard projectId={id} />
      <SetupBanner projectId={id} />
      {children}
    </>
  );
}
