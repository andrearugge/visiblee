import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="mb-8 text-center">
        <Link href="/" className="text-2xl font-bold tracking-tight hover:opacity-75 transition-opacity">
          Visiblee
        </Link>
      </div>
      {children}
    </div>
  );
}
