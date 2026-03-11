import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { AppNavbar } from '@/components/layout/app-navbar';
import { AppSidebar } from '@/components/layout/app-sidebar';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session || session.user?.role !== 'superadmin') redirect('/app');

  return (
    <div className="flex min-h-screen flex-col">
      <AppNavbar
        userName={session.user?.name ?? undefined}
        userEmail={session.user?.email ?? undefined}
      />
      <div className="flex flex-1">
        <AppSidebar isSuperadmin={true} />
        <main className="flex-1 overflow-auto bg-white dark:bg-zinc-950">
          {children}
        </main>
      </div>
    </div>
  );
}
