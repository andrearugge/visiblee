import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { ProjectSidebar } from '@/components/layout/project-sidebar';

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const { id } = await params;

  const project = await db.project.findFirst({
    where: { id, userId: session!.user.id },
    select: { id: true, name: true, brandName: true },
  });

  if (!project) notFound();

  return (
    <div className="flex flex-1">
      <ProjectSidebar projectId={id} projectName={project.name} brandName={project.brandName} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
