import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ChevronLeft } from 'lucide-react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { ExpertChat } from '@/components/features/expert-chat';

interface Props {
  params: Promise<{ id: string; convId: string }>;
}

export default async function ExpertConversationPage({ params }: Props) {
  const [session, { id, convId }, t] = await Promise.all([
    auth(),
    params,
    getTranslations('expert'),
  ]);

  const conversation = await db.expertConversation.findFirst({
    where: {
      id: convId,
      projectId: id,
      project: { userId: session!.user.id },
    },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!conversation) notFound();

  const messageCount = conversation.messages.filter((m) => m.role !== 'system').length;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <Link
          href={`/app/projects/${id}/expert`}
          className="flex items-center gap-1 text-xs text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          <ChevronLeft className="size-3.5" />
          {t('backToList')}
        </Link>
        <span className="text-zinc-300 dark:text-zinc-700">·</span>
        <h1 className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {conversation.title}
        </h1>
      </div>

      {/* Chat */}
      <div className="flex-1 overflow-hidden">
        <ExpertChat
          projectId={id}
          conversationId={convId}
          initialMessages={conversation.messages.map((m) => ({
            id: m.id,
            role: m.role as 'user' | 'assistant' | 'system',
            content: m.content,
            createdAt: m.createdAt.toISOString(),
          }))}
          messageCount={messageCount}
        />
      </div>
    </div>
  );
}
