import Link from 'next/link';
import { formatNumber } from '@/lib/format';
import { getTranslations } from 'next-intl/server';
import { db } from '@/lib/db';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

const ROLE_COLORS: Record<string, 'default' | 'secondary' | 'destructive'> = {
  superadmin: 'destructive',
  admin: 'default',
  user: 'secondary',
};

interface Props {
  searchParams: Promise<{ search?: string; role?: string }>;
}

export default async function AdminUsersPage({ searchParams }: Props) {
  const t = await getTranslations('admin');
  const { search = '', role = '' } = await searchParams;

  const where = {
    ...(search && {
      OR: [
        { email: { contains: search, mode: 'insensitive' as const } },
        { name: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
    ...(role && { role }),
  };

  const users = await db.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { _count: { select: { projects: true } }, accounts: { select: { provider: true } } },
  });

  return (
    <div className="p-6">
      <h1 className="mb-6 text-xl font-semibold">{t('users')}</h1>

      <form className="mb-4 flex gap-3">
        <Input
          name="search"
          defaultValue={search}
          placeholder={t('searchPlaceholder')}
          className="max-w-xs"
        />
        <select
          name="role"
          defaultValue={role}
          className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
        >
          <option value="">{t('allRoles')}</option>
          <option value="user">user</option>
          <option value="admin">admin</option>
          <option value="superadmin">superadmin</option>
        </select>
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Search
        </button>
      </form>

      {users.length === 0 ? (
        <p className="text-sm text-zinc-500">{t('noUsers')}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                {[t('email'), t('name'), t('role'), t('projects'), t('provider'), t('locale'), t('createdAt')].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-zinc-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <td className="px-4 py-3">
                    <Link href={`/admin/users/${user.id}`} className="font-medium hover:underline">
                      {user.email}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{user.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={ROLE_COLORS[user.role] ?? 'secondary'}>{user.role}</Badge>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{formatNumber(user._count.projects)}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {user.accounts[0]?.provider ?? 'credentials'}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{user.preferredLocale}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {user.createdAt.toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
