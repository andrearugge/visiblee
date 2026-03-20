import Link from 'next/link';
import { formatNumber } from '@/lib/format';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { buttonVariants } from "@/lib/button-variants";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Plus, Globe, BarChart3 } from 'lucide-react';

export default async function DashboardPage() {
  const [session, t] = await Promise.all([auth(), getTranslations('projects')]);

  const projects = await db.project.findMany({
    where: { userId: session!.user.id, status: { not: 'archived' } },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { targetQueries: true, contents: true } } },
  });

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('myProjects')}</h1>
        <Link
          href="/app/projects/new"
          className={cn(buttonVariants({ size: 'sm' }))}
        >
          <Plus className="mr-1.5 size-4" />
          {t('newProject')}
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 py-20 text-center dark:border-zinc-700">
          <BarChart3 className="mb-4 size-12 text-zinc-300 dark:text-zinc-600" />
          <h2 className="mb-1 text-base font-medium text-zinc-700 dark:text-zinc-300">
            {t('emptyTitle')}
          </h2>
          <p className="mb-6 max-w-sm text-sm text-zinc-500">{t('emptyDescription')}</p>
          <Link href="/app/projects/new" className={cn(buttonVariants())}>
            <Plus className="mr-1.5 size-4" />
            {t('createFirst')}
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} href={`/app/projects/${project.id}/overview`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{project.name}</CardTitle>
                    <Badge
                      variant={project.status === 'active' ? 'default' : 'secondary'}
                      className="shrink-0 text-xs"
                    >
                      {t(project.status as 'active' | 'paused')}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium text-zinc-500">{project.brandName}</p>
                </CardHeader>
                <CardContent className="pb-2">
                  <div className="flex items-center gap-1.5 text-sm text-zinc-400">
                    <Globe className="size-3.5" />
                    <span className="truncate">{project.websiteUrl}</span>
                  </div>
                </CardContent>
                <CardFooter className="text-xs text-zinc-400">
                  {formatNumber(project._count.targetQueries)} {t('queries')} · {formatNumber(project._count.contents)} {t('contents')}
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
