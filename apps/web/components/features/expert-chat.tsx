'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Send, Loader2, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}

interface ExpertChatProps {
  projectId: string;
  conversationId: string;
  initialMessages: Message[];
  messageCount: number;
}

const MAX_MESSAGES = 30;

export function ExpertChat({
  projectId,
  conversationId,
  initialMessages,
  messageCount,
}: ExpertChatProps) {
  const t = useTranslations('expert');
  const [messages, setMessages] = useState<Message[]>(
    initialMessages.filter((m) => m.role !== 'system'),
  );
  const [input, setInput] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const visibleCount = messages.length;
  const limitReached = messageCount >= MAX_MESSAGES;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleSend() {
    const text = input.trim();
    if (!text || isPending || limitReached) return;
    setInput('');
    setError(null);

    // Optimistic update
    const optimisticMsg: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/projects/${projectId}/expert/conversations/${conversationId}/messages`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: text }),
          },
        );

        if (res.status === 429) {
          setError(t('messageLimit', { limit: MAX_MESSAGES }));
          setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
          return;
        }

        if (!res.ok) throw new Error('send_failed');

        const { message: assistantMsg } = await res.json();
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== optimisticMsg.id),
          { ...optimisticMsg, id: `user-${Date.now()}` },
          assistantMsg,
        ]);
      } catch {
        setError(t('errorSending'));
        setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      }
    });
  }

  return (
    <div className="flex h-full flex-col">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {visibleCount === 0 && (
          <p className="text-center text-sm text-zinc-400">{t('emptyConversation')}</p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            {msg.role === 'assistant' && (
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white">
                <MessageSquare className="size-4" />
              </div>
            )}
            <div
              className={cn(
                'max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap',
                msg.role === 'user'
                  ? 'bg-zinc-900 text-white rounded-br-sm'
                  : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 rounded-bl-sm',
              )}
            >
              {msg.content}
            </div>
            {msg.role === 'user' && (
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300">
                {t('you').charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        ))}
        {isPending && (
          <div className="flex justify-start gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white">
              <MessageSquare className="size-4" />
            </div>
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-zinc-100 px-4 py-2.5 text-sm text-zinc-500 dark:bg-zinc-800">
              <Loader2 className="size-3.5 animate-spin" />
              <span>{t('assistant')}…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && (
        <p className="px-4 pb-2 text-center text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* Input area */}
      <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
        {limitReached ? (
          <p className="text-center text-sm text-zinc-400">
            {t('messageLimit', { limit: MAX_MESSAGES })}
          </p>
        ) : (
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('messagePlaceholder')}
              rows={1}
              className="flex-1 resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-400 focus:ring-0 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
              style={{ maxHeight: '160px', overflowY: 'auto' }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isPending}
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white transition-colors hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
