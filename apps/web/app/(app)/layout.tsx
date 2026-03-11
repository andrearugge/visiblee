import { AppNavbar } from '@/components/layout/app-navbar';
import { AppSidebar } from '@/components/layout/app-sidebar';

// Placeholder — replaced with real session in Task 1.6
interface PlaceholderSession {
  user?: { name?: string | null; email?: string | null; role?: string };
}
async function getSession(): Promise<PlaceholderSession | null> {
  return null; // TODO: replace with auth() from lib/auth.ts
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  // Placeholder: always authenticated for now (real check in Task 1.6)
  // if (!session) redirect('/login');

  return (
    <div className="flex min-h-screen flex-col">
      <AppNavbar
        userName={session?.user?.name ?? undefined}
        userEmail={session?.user?.email ?? undefined}
      />
      <div className="flex flex-1">
        <AppSidebar isSuperadmin={false} />
        <main className="flex-1 overflow-auto bg-white dark:bg-zinc-950">
          {children}
        </main>
      </div>
    </div>
  );
}
