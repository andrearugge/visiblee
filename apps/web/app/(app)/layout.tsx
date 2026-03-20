import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { AppNavbar } from '@/components/layout/app-navbar';
import { AppSidebar } from '@/components/layout/app-sidebar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session) redirect('/login');

  const isSuperadmin = session.user?.role === 'superadmin';

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <AppNavbar
        userName={session.user?.name ?? undefined}
        userEmail={session.user?.email ?? undefined}
      />
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar isSuperadmin={isSuperadmin} />
        <main className="flex-1 overflow-y-auto bg-white dark:bg-zinc-950">
          {children}
        </main>
      </div>
    </div>
  );
}
