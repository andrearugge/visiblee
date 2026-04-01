import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { QuerySubNav } from '@/components/features/query-sub-nav';

interface QueryLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string; queryId: string }>;
}

export default async function QueryLayout({ children, params }: QueryLayoutProps) {
  const [session, { id, queryId }, t] = await Promise.all([
    auth(),
    params,
    getTranslations('nav'),
  ]);

  // Verify ownership: project must belong to user, query must belong to project
  const targetQuery = await db.targetQuery.findFirst({
    where: {
      id: queryId,
      project: { id, userId: session!.user.id },
    },
    select: { id: true, queryText: true },
  });

  if (!targetQuery) notFound();

  const base = `/app/projects/${id}/queries/${queryId}`;

  const tabs = [
    { href: `${base}/coverage`,         label: t('queryCoverage') },
    { href: `${base}/citations`,        label: t('queryCitations') },
    { href: `${base}/competitors`,      label: t('queryCompetitors') },
    { href: `${base}/recommendations`,  label: t('queryRecommendations') },
  ];

  return (
    <div className="flex flex-col">
      {/* Query header */}
      <div className="border-b border-zinc-200 bg-white px-6 py-4">
        <Link
          href={`/app/projects/${id}/queries`}
          className="mb-1 flex items-center gap-1 text-xs text-zinc-400 transition-colors hover:text-zinc-600"
        >
          ← {t('queries')}
        </Link>
        <p className="text-sm font-semibold text-zinc-900">{targetQuery.queryText}</p>
      </div>

      {/* Tab navigation */}
      <QuerySubNav tabs={tabs} />

      {/* Page content */}
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}
