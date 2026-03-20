import { notFound } from 'next/navigation';
import { formatNumber } from '@/lib/format';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AdminRoleForm } from '@/components/features/admin-role-form';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminUserDetailPage({ params }: Props) {
  const [{ id }, t, tProjects] = await Promise.all([
    params,
    getTranslations('admin'),
    getTranslations('projects'),
  ]);

  const user = await db.user.findUnique({
    where: { id },
    include: {
      _count: { select: { projects: true } },
      accounts: { select: { provider: true } },
      projects: { where: { status: { not: 'archived' } }, orderBy: { createdAt: 'desc' } },
    },
  });

  if (!user) notFound();

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/admin/users" className="text-sm text-zinc-500 hover:underline">
          ← {t('users')}
        </Link>
      </div>

      <h1 className="text-xl font-semibold">{t('userDetail')}</h1>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-zinc-500">{t('email')}</span>
            <span className="text-sm font-medium">{user.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-zinc-500">{t('name')}</span>
            <span className="text-sm font-medium">{user.name ?? '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-zinc-500">{t('provider')}</span>
            <span className="text-sm font-medium">{user.accounts[0]?.provider ?? 'credentials'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-zinc-500">{t('locale')}</span>
            <span className="text-sm font-medium">{user.preferredLocale}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-zinc-500">{t('createdAt')}</span>
            <span className="text-sm font-medium">{user.createdAt.toLocaleDateString()}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('role')}</CardTitle>
        </CardHeader>
        <CardContent>
          <AdminRoleForm userId={user.id} currentRole={user.role} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {tProjects('myProjects')} ({formatNumber(user._count.projects)})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {user.projects.length === 0 ? (
            <p className="text-sm text-zinc-500">{tProjects('emptyTitle')}</p>
          ) : (
            <div className="space-y-2">
              {user.projects.map((project) => (
                <div key={project.id} className="flex items-center justify-between rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
                  <div>
                    <p className="text-sm font-medium">{project.name}</p>
                    <p className="text-xs text-zinc-500">{project.websiteUrl}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs">{project.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
