import { redirect } from 'next/navigation';
import { AppNavbar } from '@/components/layout/app-navbar';
import { AppSidebar } from '@/components/layout/app-sidebar';

// Placeholder auth + role check — replaced with real session in Task 1.6/1.8
async function getSession() {
  return null; // TODO: replace with auth() from lib/auth.ts
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  // Placeholder: always passes for now (real check in Task 1.6/1.8)
  // const isSuperadmin = session?.user?.role === 'superadmin';
  // if (!session || !isSuperadmin) redirect('/app');

  return (
    <div className="flex min-h-screen flex-col">
      <AppNavbar />
      <div className="flex flex-1">
        <AppSidebar isSuperadmin={true} />
        <main className="flex-1 overflow-auto bg-white dark:bg-zinc-950">
          {children}
        </main>
      </div>
    </div>
  );
}
