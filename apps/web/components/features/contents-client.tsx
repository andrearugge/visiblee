'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  Check,
  X,
  Plus,
  Download,
  RefreshCw,
  ExternalLink,
  FileText,
  Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { PlatformBadge } from './platform-badge';

interface ContentItem {
  id: string;
  url: string;
  title: string | null;
  platform: string;
  contentType: string;
  isConfirmed: boolean;
  isIndexed: boolean;
  wordCount: number | null;
  discoveryConfidence: number | null;
  lastFetchedAt: string | null;
  _count: { passages: number };
}

interface ContentsClientProps {
  projectId: string;
  initialContents: ContentItem[];
}

type Tab = 'toVerify' | 'own' | 'mentions';

// ─── Add URL form ─────────────────────────────────────────────────────────────

function AddUrlForm({
  projectId,
  onAdded,
}: {
  projectId: string;
  onAdded: (item: ContentItem) => void;
}) {
  const t = useTranslations('contents');
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'duplicate'>('idle');

  async function handleAdd() {
    setStatus('loading');
    const res = await fetch(`/api/projects/${projectId}/contents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (res.status === 409) {
      setStatus('duplicate');
      return;
    }
    if (!res.ok) {
      setStatus('error');
      return;
    }
    const item = await res.json();
    onAdded(item);
    setUrl('');
    setOpen(false);
    setStatus('idle');
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <Plus className="size-3.5" />
        {t('addUrl')}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        autoFocus
        type="url"
        placeholder={t('addUrlPlaceholder')}
        value={url}
        onChange={(e) => { setUrl(e.target.value); setStatus('idle'); }}
        onKeyDown={(e) => e.key === 'Enter' && url && handleAdd()}
        className="h-8 w-72 text-sm"
      />
      <Button size="sm" onClick={handleAdd} disabled={!url || status === 'loading'} className="h-8">
        {status === 'loading' ? t('addUrlAdding') : t('addUrlSubmit')}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => { setOpen(false); setStatus('idle'); }} className="h-8">
        <X className="size-3.5" />
      </Button>
      {status === 'error' && <p className="text-xs text-red-500">{t('addUrlError')}</p>}
      {status === 'duplicate' && <p className="text-xs text-amber-600">{t('addUrlDuplicate')}</p>}
    </div>
  );
}

// ─── Content row ──────────────────────────────────────────────────────────────

function ContentRow({
  item,
  projectId,
  showActions,
  onConfirm,
  onDiscard,
  onFetch,
}: {
  item: ContentItem;
  projectId: string;
  showActions: boolean;
  onConfirm: (id: string) => void;
  onDiscard: (id: string) => void;
  onFetch: (id: string) => void;
}) {
  const t = useTranslations('contents');
  const [fetchStatus, setFetchStatus] = useState<'idle' | 'queued'>('idle');

  async function handleFetch() {
    const res = await fetch(`/api/projects/${projectId}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'fetch_content', contentId: item.id }),
    });
    if (res.ok) {
      setFetchStatus('queued');
      onFetch(item.id);
    }
  }

  const displayUrl = (() => {
    try {
      const u = new URL(item.url);
      return u.hostname + u.pathname;
    } catch {
      return item.url;
    }
  })();

  return (
    <div className="flex items-center gap-3 rounded-lg border border-zinc-100 bg-white px-4 py-3 hover:border-zinc-200 transition-colors">
      {/* Platform icon */}
      <Globe className="size-4 shrink-0 text-zinc-300" />

      {/* Main content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <PlatformBadge platform={item.platform} />
          {item.isConfirmed && (
            <span className="inline-flex items-center gap-1 rounded-md bg-green-50 px-1.5 py-0.5 text-xs font-medium text-green-700">
              <Check className="size-3" />
              {t('confirmed')}
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-sm font-medium text-zinc-800">
          {item.title ?? displayUrl}
        </p>
        <div className="mt-0.5 flex items-center gap-3 text-xs text-zinc-400">
          <span className="truncate max-w-xs">{displayUrl}</span>
          {item.wordCount ? (
            <span>{t('words', { n: item.wordCount })}</span>
          ) : null}
          {item.lastFetchedAt ? (
            <span>{t('passages', { n: item._count.passages })}</span>
          ) : (
            <span>{t('notFetched')}</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1.5">
        {item.isConfirmed && (
          <>
            <Link
              href={`/app/projects/${projectId}/contents/${item.id}`}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
            >
              <FileText className="size-3" />
              Detail
            </Link>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-md border border-zinc-200 bg-white p-1 text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              <ExternalLink className="size-3.5" />
            </a>
            {!item.lastFetchedAt && (
              fetchStatus === 'queued' ? (
                <span className="text-xs text-green-600">{t('fetchQueued')}</span>
              ) : (
                <Button size="sm" variant="outline" onClick={handleFetch} className="h-7 gap-1 text-xs">
                  <Download className="size-3" />
                  {t('fetch')}
                </Button>
              )
            )}
          </>
        )}

        {showActions && (
          <>
            <Button
              size="sm"
              onClick={() => onConfirm(item.id)}
              className="h-7 gap-1 bg-green-600 text-xs hover:bg-green-700 text-white"
            >
              <Check className="size-3" />
              {t('confirm')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onDiscard(item.id)}
              className="h-7 gap-1 text-xs text-zinc-500 hover:text-red-600"
            >
              <X className="size-3" />
              {t('discard')}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main client component ────────────────────────────────────────────────────

export function ContentsClient({ projectId, initialContents }: ContentsClientProps) {
  const t = useTranslations('contents');
  const [contents, setContents] = useState<ContentItem[]>(initialContents);
  const [activeTab, setActiveTab] = useState<Tab>('toVerify');
  const [discoveryStatus, setDiscoveryStatus] = useState<'idle' | 'queued' | 'error'>('idle');

  const toVerify = contents.filter((c) => !c.isConfirmed);
  const own = contents.filter((c) => c.isConfirmed && c.contentType === 'own');
  const mentions = contents.filter((c) => c.isConfirmed && c.contentType === 'mention');

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'toVerify', label: t('tabToVerify'), count: toVerify.length },
    { key: 'own', label: t('tabOwn'), count: own.length },
    { key: 'mentions', label: t('tabMentions'), count: mentions.length },
  ];

  const activeItems = activeTab === 'toVerify' ? toVerify : activeTab === 'own' ? own : mentions;

  async function handleRunDiscovery() {
    const res = await fetch(`/api/projects/${projectId}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'discovery' }),
    });
    setDiscoveryStatus(res.ok ? 'queued' : 'error');
  }

  async function handleConfirm(id: string) {
    const res = await fetch(`/api/projects/${projectId}/contents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isConfirmed: true }),
    });
    if (res.ok) {
      setContents((prev) =>
        prev.map((c) => (c.id === id ? { ...c, isConfirmed: true } : c)),
      );
    }
  }

  async function handleDiscard(id: string) {
    const res = await fetch(`/api/projects/${projectId}/contents/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setContents((prev) => prev.filter((c) => c.id !== id));
    }
  }

  function handleAdded(item: ContentItem) {
    setContents((prev) => [item, ...prev]);
    setActiveTab('own');
  }

  if (contents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50">
          <Globe className="size-6 text-zinc-400" />
        </div>
        <h2 className="mb-2 text-lg font-semibold text-zinc-900">{t('emptyStateTitle')}</h2>
        <p className="mb-8 max-w-sm text-sm text-zinc-500">{t('emptyStateSubtitle')}</p>
        <div className="flex items-center gap-3">
          {discoveryStatus === 'queued' ? (
            <p className="text-sm text-green-600">{t('discoveryQueued')}</p>
          ) : (
            <Button onClick={handleRunDiscovery} className="gap-2">
              <RefreshCw className="size-4" />
              {t('runDiscovery')}
            </Button>
          )}
          {discoveryStatus === 'error' && (
            <p className="text-sm text-red-500">{t('discoveryError')}</p>
          )}
          <AddUrlForm projectId={projectId} onAdded={handleAdded} />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Toolbar */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                activeTab === tab.key
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-700',
              )}
            >
              {tab.label}
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-xs tabular-nums',
                  activeTab === tab.key ? 'bg-zinc-100 text-zinc-600' : 'bg-zinc-200/60 text-zinc-400',
                )}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {discoveryStatus === 'queued' ? (
            <p className="text-sm text-green-600">{t('discoveryQueued')}</p>
          ) : (
            <Button variant="outline" size="sm" onClick={handleRunDiscovery} className="gap-1.5">
              <RefreshCw className="size-3.5" />
              {t('runDiscovery')}
            </Button>
          )}
          {discoveryStatus === 'error' && (
            <p className="text-xs text-red-500">{t('discoveryError')}</p>
          )}
          <AddUrlForm projectId={projectId} onAdded={handleAdded} />
        </div>
      </div>

      {/* Content list */}
      {activeItems.length === 0 ? (
        <p className="py-12 text-center text-sm text-zinc-400">
          {activeTab === 'toVerify'
            ? t('emptyTabToVerify')
            : activeTab === 'own'
              ? t('emptyTabOwn')
              : t('emptyTabMentions')}
        </p>
      ) : (
        <div className="space-y-2">
          {activeItems.map((item) => (
            <ContentRow
              key={item.id}
              item={item}
              projectId={projectId}
              showActions={activeTab === 'toVerify'}
              onConfirm={handleConfirm}
              onDiscard={handleDiscard}
              onFetch={() => {}}
            />
          ))}
        </div>
      )}
    </div>
  );
}
