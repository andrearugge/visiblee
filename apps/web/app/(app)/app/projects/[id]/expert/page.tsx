import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { MessageSquare } from 'lucide-react';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ExpertPage({ params }: Props) {
  const [session, { id }, t] = await Promise.all([
    auth(),
    params,
    getTranslations('expert'),
  ]);

  const project = await db.project.findFirst({
    where: { id, userId: session!.user.id },
    select: { id: true },
  });
  if (!project) notFound();

  const conversations = await db.expertConversation.findMany({
    where: { projectId: id },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{t('title')}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t('subtitle')}</p>
      </div>

      {conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 px-8 py-16 text-center dark:border-zinc-800">
          <MessageSquare className="mb-4 size-10 text-zinc-300 dark:text-zinc-600" />
          <p className="font-medium text-zinc-700 dark:text-zinc-300">{t('noConversations')}</p>
          <p className="mt-1 max-w-sm text-sm text-zinc-400">{t('noConversationsHint')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {conversations.map((conv) => {
            const msgCount = conv._count.messages;
            return (
              <Link
                key={conv.id}
                href={`/app/projects/${id}/expert/${conv.id}`}
                className="flex items-start justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <MessageSquare className="size-4 text-zinc-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 line-clamp-2">
                      {conv.title}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-400">
                      {t('messages', { count: msgCount })} ·{' '}
                      {new Date(conv.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                {conv.status === 'archived' && (
                  <span className="ml-3 shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800">
                    {t('archived')}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
