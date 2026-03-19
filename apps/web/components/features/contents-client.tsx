'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
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
  Trash2,
  Sparkles,
  Search,
  Brain,
  Filter,
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
  initialDiscoveryRunning?: boolean;
}

type Tab = 'toVerify' | 'own' | 'mentions';

const POLL_INTERVAL = 4000;

// ─── Discovery loader ──────────────────────────────────────────────────────────

const DISCOVERY_STEPS = [
  { icon: Search, labelKey: 'discoveryStep1' as const },
  { icon: Globe,  labelKey: 'discoveryStep2' as const },
  { icon: Brain,  labelKey: 'discoveryStep3' as const },
  { icon: Filter, labelKey: 'discoveryStep4' as const },
];

function DiscoveryLoader() {
  const t = useTranslations('contents');
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setStepIndex((i) => (i + 1) % DISCOVERY_STEPS.length), 2500);
    return () => clearInterval(id);
  }, []);

  const ActiveIcon = DISCOVERY_STEPS[stepIndex].icon;

  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      {/* Animated icon ring */}
      <div className="relative mb-8 flex size-20 items-center justify-center">
        <div className="absolute inset-0 animate-ping rounded-full bg-zinc-100" />
        <div className="absolute inset-2 animate-pulse rounded-full bg-zinc-100" />
        <div className="relative flex size-14 items-center justify-center rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <ActiveIcon className="size-6 text-zinc-500 transition-all duration-300" />
        </div>
      </div>

      <h2 className="mb-2 text-lg font-semibold text-zinc-900">{t('discoveryLoadingTitle')}</h2>
      <p className="mb-8 max-w-sm text-sm text-zinc-500">{t('discoveryLoadingSubtitle')}</p>

      {/* Step indicators */}
      <div className="mb-10 flex items-center gap-2">
        {DISCOVERY_STEPS.map((step, i) => {
          const Icon = step.icon;
          const isActive = i === stepIndex;
          const isPast = i < stepIndex;
          return (
            <div
              key={i}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-300',
                isActive
                  ? 'bg-zinc-900 text-white shadow-sm'
                  : isPast
                  ? 'bg-zinc-100 text-zinc-400'
                  : 'bg-zinc-50 text-zinc-300',
              )}
            >
              <Icon className="size-3" />
              <span className={cn('transition-all duration-300', !isActive && 'hidden sm:inline')}>
                {t(step.labelKey)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Skeleton cards */}
      <div className="w-full max-w-2xl space-y-2">
        {[0.95, 0.8, 0.65].map((opacity, i) => (
          <div
            key={i}
            className="flex animate-pulse items-center gap-3 rounded-lg border border-zinc-100 bg-white px-4 py-3"
            style={{ opacity }}
          >
            <div className="size-4 rounded-full bg-zinc-100" />
            <div className="size-4 rounded-full bg-zinc-100" />
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <div className="h-4 w-16 rounded-full bg-zinc-100" />
              </div>
              <div className="h-3.5 w-3/4 rounded bg-zinc-100" />
              <div className="h-3 w-1/2 rounded bg-zinc-50" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Results ready banner ─────────────────────────────────────────────────────

function ResultsReadyBanner({ count, onLoad }: { count: number; onLoad: () => void }) {
  const t = useTranslations('contents');
  return (
    <div className="mb-4 flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-green-600" />
        <p className="text-sm font-medium text-green-800">
          {t('discoveryResultsReady', { n: count })}
        </p>
      </div>
      <Button size="sm" onClick={onLoad} className="h-7 bg-green-600 text-xs hover:bg-green-700 text-white">
        {t('discoveryLoadResults')}
      </Button>
    </div>
  );
}

// ─── Checkbox ─────────────────────────────────────────────────────────────────

function Checkbox({
  checked,
  indeterminate,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  label?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={label}
      className="size-4 cursor-pointer rounded border-zinc-300 text-zinc-900 accent-zinc-800"
    />
  );
}

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
    if (res.status === 409) { setStatus('duplicate'); return; }
    if (!res.ok) { setStatus('error'); return; }
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
  isSelected,
  onToggleSelect,
  onConfirm,
  onDiscard,
  onFetch,
}: {
  item: ContentItem;
  projectId: string;
  showActions: boolean;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
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
    if (res.ok) { setFetchStatus('queued'); onFetch(item.id); }
  }

  const displayUrl = (() => {
    try { const u = new URL(item.url); return u.hostname + u.pathname; }
    catch { return item.url; }
  })();

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border bg-white px-4 py-3 transition-colors',
        isSelected ? 'border-zinc-400 bg-zinc-50' : 'border-zinc-100 hover:border-zinc-200',
      )}
    >
      <Checkbox
        checked={isSelected}
        onChange={() => onToggleSelect(item.id)}
        label={`Select ${item.title ?? displayUrl}`}
      />
      <Globe className="size-4 shrink-0 text-zinc-300" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <PlatformBadge platform={item.platform} />
          {item.isConfirmed && (
            <span className="inline-flex items-center gap-1 rounded-md bg-green-50 px-1.5 py-0.5 text-xs font-medium text-green-700">
              <Check className="size-3" />{t('confirmed')}
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-sm font-medium text-zinc-800">{item.title ?? displayUrl}</p>
        <div className="mt-0.5 flex items-center gap-3 text-xs text-zinc-400">
          <span className="truncate max-w-xs">{displayUrl}</span>
          {item.wordCount ? <span>{t('words', { n: item.wordCount })}</span> : null}
          {item.lastFetchedAt
            ? <span>{t('passages', { n: item._count.passages })}</span>
            : <span>{t('notFetched')}</span>}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {item.isConfirmed && (
          <>
            <Link
              href={`/app/projects/${projectId}/contents/${item.id}`}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
            >
              <FileText className="size-3" />Detail
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
              fetchStatus === 'queued'
                ? <span className="text-xs text-green-600">{t('fetchQueued')}</span>
                : (
                  <Button size="sm" variant="outline" onClick={handleFetch} className="h-7 gap-1 text-xs">
                    <Download className="size-3" />{t('fetch')}
                  </Button>
                )
            )}
          </>
        )}
        {showActions && (
          <>
            <Button size="sm" onClick={() => onConfirm(item.id)} className="h-7 gap-1 bg-green-600 text-xs hover:bg-green-700 text-white">
              <Check className="size-3" />{t('confirm')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => onDiscard(item.id)} className="h-7 gap-1 text-xs text-zinc-500 hover:text-red-600">
              <X className="size-3" />{t('discard')}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Bulk action bar ───────────────────────────────────────────────────────────

function BulkBar({
  count,
  showConfirm,
  onConfirm,
  onDiscard,
  onClear,
}: {
  count: number;
  showConfirm: boolean;
  onConfirm: () => void;
  onDiscard: () => void;
  onClear: () => void;
}) {
  const t = useTranslations('contents');
  return (
    <div
      className={cn(
        'fixed bottom-8 left-1/2 z-50 -translate-x-1/2 transition-all duration-200',
        count > 0 ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0',
      )}
    >
      <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 shadow-xl shadow-zinc-300/40">
        <span className="text-sm font-medium text-zinc-700">{t('bulkSelected', { n: count })}</span>
        <div className="h-4 w-px bg-zinc-200" />
        {showConfirm && (
          <Button size="sm" onClick={onConfirm} className="h-7 gap-1.5 bg-green-600 text-xs hover:bg-green-700 text-white">
            <Check className="size-3" />{t('bulkConfirm', { n: count })}
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={onDiscard} className="h-7 gap-1.5 text-xs text-zinc-500 hover:border-red-200 hover:text-red-600">
          <Trash2 className="size-3" />{t('bulkDiscard', { n: count })}
        </Button>
        <button onClick={onClear} className="text-zinc-400 transition-colors hover:text-zinc-600" aria-label="Clear selection">
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Main client component ────────────────────────────────────────────────────

export function ContentsClient({ projectId, initialContents, initialDiscoveryRunning = false }: ContentsClientProps) {
  const t = useTranslations('contents');
  const [contents, setContents] = useState<ContentItem[]>(initialContents);
  const [activeTab, setActiveTab] = useState<Tab>('toVerify');
  const [discoveryStatus, setDiscoveryStatus] = useState<'idle' | 'queued' | 'error'>(
    initialDiscoveryRunning ? 'queued' : 'idle',
  );
  const [pendingContents, setPendingContents] = useState<ContentItem[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<'idle' | 'loading'>('idle');

  // ── Polling ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (discoveryStatus !== 'queued') return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/contents`);
        if (!res.ok) return;
        const items: ContentItem[] = await res.json();
        if (items.length > contents.length) {
          setPendingContents(items);
          setDiscoveryStatus('idle');
        }
      } catch {
        // network error — keep polling
      }
    };

    const id = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [discoveryStatus, projectId, contents.length]);

  // ── Derived state ────────────────────────────────────────────────────────────
  const toVerify = contents.filter((c) => !c.isConfirmed);
  const own = contents.filter((c) => c.isConfirmed && c.contentType === 'own');
  const mentions = contents.filter((c) => c.isConfirmed && c.contentType === 'mention');

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'toVerify', label: t('tabToVerify'), count: toVerify.length },
    { key: 'own', label: t('tabOwn'), count: own.length },
    { key: 'mentions', label: t('tabMentions'), count: mentions.length },
  ];

  const activeItems = activeTab === 'toVerify' ? toVerify : activeTab === 'own' ? own : mentions;
  const selectedInTab = activeItems.filter((i) => selectedIds.has(i.id));
  const allSelected = activeItems.length > 0 && selectedInTab.length === activeItems.length;
  const someSelected = selectedInTab.length > 0 && !allSelected;

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function handleSetTab(tab: Tab) {
    setActiveTab(tab);
    setSelectedIds(new Set());
  }

  async function handleRunDiscovery() {
    const res = await fetch(`/api/projects/${projectId}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'discovery' }),
    });
    if (res.ok) {
      setPendingContents(null);
      setDiscoveryStatus('queued');
    } else {
      setDiscoveryStatus('error');
    }
  }

  function handleLoadResults() {
    if (!pendingContents) return;
    setContents(pendingContents);
    setPendingContents(null);
    setSelectedIds(new Set());
    setActiveTab('toVerify');
  }

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  function handleSelectAll() {
    setSelectedIds(allSelected ? new Set() : new Set(activeItems.map((i) => i.id)));
  }

  async function handleConfirm(id: string) {
    const res = await fetch(`/api/projects/${projectId}/contents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isConfirmed: true }),
    });
    if (res.ok) {
      setContents((prev) => prev.map((c) => (c.id === id ? { ...c, isConfirmed: true } : c)));
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }
  }

  async function handleDiscard(id: string) {
    const res = await fetch(`/api/projects/${projectId}/contents/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setContents((prev) => prev.filter((c) => c.id !== id));
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }
  }

  async function handleBulkConfirm() {
    if (bulkStatus === 'loading') return;
    setBulkStatus('loading');
    const ids = [...selectedIds];
    await Promise.all(ids.map((id) =>
      fetch(`/api/projects/${projectId}/contents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isConfirmed: true }),
      }),
    ));
    setContents((prev) => prev.map((c) => (ids.includes(c.id) ? { ...c, isConfirmed: true } : c)));
    setSelectedIds(new Set());
    setBulkStatus('idle');
  }

  async function handleBulkDiscard() {
    if (bulkStatus === 'loading') return;
    setBulkStatus('loading');
    const ids = [...selectedIds];
    await Promise.all(ids.map((id) =>
      fetch(`/api/projects/${projectId}/contents/${id}`, { method: 'DELETE' }),
    ));
    setContents((prev) => prev.filter((c) => !ids.includes(c.id)));
    setSelectedIds(new Set());
    setBulkStatus('idle');
  }

  function handleAdded(item: ContentItem) {
    setContents((prev) => [item, ...prev]);
    setActiveTab('own');
  }

  // ── Render: discovery loading (empty + queued) ────────────────────────────
  if (contents.length === 0 && discoveryStatus === 'queued') {
    return <DiscoveryLoader />;
  }

  // ── Render: empty state ───────────────────────────────────────────────────
  if (contents.length === 0 && !pendingContents) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50">
          <Globe className="size-6 text-zinc-400" />
        </div>
        <h2 className="mb-2 text-lg font-semibold text-zinc-900">{t('emptyStateTitle')}</h2>
        <p className="mb-8 max-w-sm text-sm text-zinc-500">{t('emptyStateSubtitle')}</p>
        <div className="flex items-center gap-3">
          <Button onClick={handleRunDiscovery} className="gap-2">
            <RefreshCw className="size-4" />
            {t('runDiscovery')}
          </Button>
          {discoveryStatus === 'error' && <p className="text-sm text-red-500">{t('discoveryError')}</p>}
          <AddUrlForm projectId={projectId} onAdded={handleAdded} />
        </div>
      </div>
    );
  }

  // ── Render: main list ─────────────────────────────────────────────────────
  return (
    <div className="relative p-6">
      {/* Results ready banner */}
      {pendingContents && (
        <ResultsReadyBanner count={pendingContents.length} onLoad={handleLoadResults} />
      )}

      {/* Toolbar */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleSetTab(tab.key)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                activeTab === tab.key ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700',
              )}
            >
              {tab.label}
              <span className={cn(
                'rounded-full px-1.5 py-0.5 text-xs tabular-nums',
                activeTab === tab.key ? 'bg-zinc-100 text-zinc-600' : 'bg-zinc-200/60 text-zinc-400',
              )}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {discoveryStatus === 'queued' ? (
            <span className="flex items-center gap-1.5 text-sm text-zinc-500">
              <RefreshCw className="size-3.5 animate-spin" />
              {t('discoveryRunning')}
            </span>
          ) : (
            <Button variant="outline" size="sm" onClick={handleRunDiscovery} className="gap-1.5">
              <RefreshCw className="size-3.5" />
              {t('runDiscovery')}
            </Button>
          )}
          {discoveryStatus === 'error' && <p className="text-xs text-red-500">{t('discoveryError')}</p>}
          <AddUrlForm projectId={projectId} onAdded={handleAdded} />
        </div>
      </div>

      {/* Content list */}
      {activeItems.length === 0 ? (
        <p className="py-12 text-center text-sm text-zinc-400">
          {activeTab === 'toVerify' ? t('emptyTabToVerify') : activeTab === 'own' ? t('emptyTabOwn') : t('emptyTabMentions')}
        </p>
      ) : (
        <>
          <div className="mb-2 flex items-center gap-3 px-4 py-1.5">
            <Checkbox
              checked={allSelected}
              indeterminate={someSelected}
              onChange={handleSelectAll}
              label="Select all"
            />
            <span className="text-xs text-zinc-400">
              {allSelected
                ? t('selectAllActive', { n: activeItems.length })
                : t('selectAll', { n: activeItems.length })}
            </span>
          </div>

          <div className="space-y-2">
            {activeItems.map((item) => (
              <ContentRow
                key={item.id}
                item={item}
                projectId={projectId}
                showActions={activeTab === 'toVerify'}
                isSelected={selectedIds.has(item.id)}
                onToggleSelect={handleToggleSelect}
                onConfirm={handleConfirm}
                onDiscard={handleDiscard}
                onFetch={() => {}}
              />
            ))}
          </div>

          <BulkBar
            count={selectedInTab.length}
            showConfirm={activeTab === 'toVerify'}
            onConfirm={handleBulkConfirm}
            onDiscard={handleBulkDiscard}
            onClear={() => setSelectedIds(new Set())}
          />
        </>
      )}
    </div>
  );
}
