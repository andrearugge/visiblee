import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { ProjectProvider } from '@/components/layout/project-context';

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
    select: { id: true, name: true, brandName: true },
  });

  if (!project) notFound();

  return (
    <ProjectProvider project={{ id: project.id, name: project.name, brandName: project.brandName }}>
      <main className="flex-1 overflow-auto">{children}</main>
    </ProjectProvider>
  );
}
