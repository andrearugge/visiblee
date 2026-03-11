export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="mb-8 text-center">
        <span className="text-2xl font-bold tracking-tight">Visiblee</span>
      </div>
      {children}
    </div>
  );
}
