import { getTranslations } from 'next-intl/server';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, FolderOpen, Activity } from 'lucide-react';

export default async function AdminDashboardPage() {
  const t = await getTranslations('admin');

  const [totalUsers, totalProjects, activeProjects] = await Promise.all([
    db.user.count(),
    db.project.count(),
    db.project.count({ where: { status: 'active' } }),
  ]);

  const stats = [
    { label: t('totalUsers'), value: totalUsers, icon: Users },
    { label: t('totalProjects'), value: totalProjects, icon: FolderOpen },
    { label: t('activeProjects'), value: activeProjects, icon: Activity },
  ];

  return (
    <div className="p-6">
      <h1 className="mb-6 text-xl font-semibold">{t('dashboard')}</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-zinc-500">{label}</CardTitle>
              <Icon className="size-4 text-zinc-400" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
