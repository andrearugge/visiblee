import { ProjectSidebar } from '@/components/layout/project-sidebar';

export default function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  // params is a Promise in Next.js 15+ — unwrapped at the page level when needed
  // Here we pass the id to the sidebar via a sync wrapper using React.use in child
  return (
    <ProjectLayoutInner params={params}>{children}</ProjectLayoutInner>
  );
}

// Inner component to unwrap async params
async function ProjectLayoutInner({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="flex flex-1">
      <ProjectSidebar projectId={id} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
