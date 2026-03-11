import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Visiblee</h1>
        <Button>shadcn/ui is working</Button>
      </div>
    </div>
  );
}
