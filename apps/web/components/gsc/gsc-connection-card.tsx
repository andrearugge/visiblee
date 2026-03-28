'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useFormatter } from 'next-intl';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Unlink,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useJobPolling } from '@/hooks/use-job-polling';

interface GscStatus {
  connected: boolean;
  status: string | null;
  propertyUrl: string | null;
  lastSyncAt: string | null;
  pendingJobId: string | null;
  queryCount: number;
  profileCount: number;
}

interface GscProperty {
  siteUrl: string;
  permissionLevel: string;
}

interface GscConnectionCardProps {
  projectId: string;
  websiteUrl: string;
  initialStatus: GscStatus | null;
}

function formatRelativeTime(
  dateStr: string | null,
  t: ReturnType<typeof useTranslations<'gsc.connection'>>,
): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return t('justNow');
  if (mins < 60) return t('minutesAgo', { minutes: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('hoursAgo', { hours });
  return t('daysAgo', { days: Math.floor(hours / 24) });
}

export function GscConnectionCard({
  projectId,
  websiteUrl,
  initialStatus,
}: GscConnectionCardProps) {
  const t = useTranslations('gsc.connection');
  const router = useRouter();

  const [status, setStatus] = useState<GscStatus | null>(initialStatus);
  const [properties, setProperties] = useState<GscProperty[]>([]);
  const [selectedProperty, setSelectedProperty] = useState('');
  const [loadingProps, setLoadingProps] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [propsError, setPropsError] = useState('');

  const pendingJobId = status?.pendingJobId ?? null;

  // Poll while a gsc_sync job is running
  useJobPolling({
    active: !!pendingJobId,
    url: `/api/gsc/status?projectId=${projectId}`,
    isDone: (data) => {
      const d = data as GscStatus;
      return !d.pendingJobId;
    },
    onDone: (data) => {
      setStatus(data as GscStatus);
      setSyncing(false);
      router.refresh();
    },
    interval: 4000,
  });

  // If connected but no property selected, fetch properties
  useEffect(() => {
    if (status?.connected && !status.propertyUrl) {
      setLoadingProps(true);
      fetch(`/api/gsc/properties?projectId=${projectId}`)
        .then((r) => r.json())
        .then((data) => {
          setProperties(data.properties ?? []);
          setPropsError(data.error ?? '');
          // Auto-select best match
          const match = data.properties?.find((p: GscProperty) =>
            p.siteUrl.includes(new URL(websiteUrl).hostname),
          );
          if (match) setSelectedProperty(match.siteUrl);
          else if (data.properties?.length) setSelectedProperty(data.properties[0].siteUrl);
        })
        .catch(() => setPropsError('Failed to load properties'))
        .finally(() => setLoadingProps(false));
    }
  }, [status?.connected, status?.propertyUrl, projectId, websiteUrl]);

  async function handleConnect() {
    setConnecting(true);
    window.location.href = `/api/gsc/connect?projectId=${projectId}`;
  }

  async function handleSelectProperty() {
    if (!selectedProperty) return;
    setConnecting(true);
    const res = await fetch('/api/gsc/select-property', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, propertyUrl: selectedProperty }),
    });
    setConnecting(false);
    if (res.ok) {
      const data = await res.json();
      setStatus((s) => s ? { ...s, propertyUrl: selectedProperty, pendingJobId: data.jobId } : s);
      setSyncing(true);
    }
  }

  async function handleSyncNow() {
    setSyncing(true);
    const res = await fetch('/api/gsc/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId }),
    });
    if (res.ok) {
      const data = await res.json();
      setStatus((s) => s ? { ...s, pendingJobId: data.jobId } : s);
    } else {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    const res = await fetch('/api/gsc/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId }),
    });
    setDisconnecting(false);
    setDisconnectOpen(false);
    if (res.ok) {
      setStatus(null);
      router.refresh();
    }
  }

  const isRevoked = status?.status === 'revoked';
  const isSyncing = !!pendingJobId || syncing;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-zinc-900">{t('title')}</h3>
        {status?.connected && !isRevoked && (
          <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
            <CheckCircle2 className="size-3" />
            {t('connectedBadge')}
          </span>
        )}
      </div>

      <div className="p-4">
        {/* ── State 1: Not connected ── */}
        {!status?.connected && (
          <div className="space-y-3">
            <p className="text-sm text-zinc-600">{t('disconnectedDescription')}</p>
            <ul className="space-y-1.5">
              {(['benefit1', 'benefit2', 'benefit3'] as const).map((key) => (
                <li key={key} className="flex items-center gap-2 text-sm text-zinc-600">
                  <CheckCircle2 className="size-3.5 shrink-0 text-visiblee-green-500" />
                  {t(key)}
                </li>
              ))}
            </ul>
            <Button
              className="mt-1 bg-visiblee-green-500 hover:bg-visiblee-green-600 text-white"
              onClick={handleConnect}
              disabled={connecting}
            >
              {connecting ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <ExternalLink className="mr-2 size-4" />
              )}
              {t('connectButton')}
            </Button>
          </div>
        )}

        {/* ── Revoked warning ── */}
        {isRevoked && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-500" />
              <p className="text-sm text-amber-800">{t('revokedWarning')}</p>
            </div>
            <Button
              className="bg-visiblee-green-500 hover:bg-visiblee-green-600 text-white"
              onClick={handleConnect}
              disabled={connecting}
            >
              {t('connectButton')}
            </Button>
          </div>
        )}

        {/* ── State 2: Connected, selecting property ── */}
        {status?.connected && !status.propertyUrl && !isRevoked && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-zinc-700">{t('selectPropertyTitle')}</p>
            {loadingProps ? (
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <Loader2 className="size-4 animate-spin" />
                Loading properties…
              </div>
            ) : propsError ? (
              <p className="text-sm text-red-500">{t('noProperties')}</p>
            ) : (
              <div className="space-y-1.5">
                {properties.map((p) => {
                  const isMatch = p.siteUrl.includes(new URL(websiteUrl).hostname);
                  return (
                    <label
                      key={p.siteUrl}
                      className={cn(
                        'flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors',
                        selectedProperty === p.siteUrl
                          ? 'border-visiblee-green-300 bg-visiblee-green-50'
                          : 'border-zinc-200 hover:border-zinc-300',
                      )}
                    >
                      <input
                        type="radio"
                        name="property"
                        value={p.siteUrl}
                        checked={selectedProperty === p.siteUrl}
                        onChange={() => setSelectedProperty(p.siteUrl)}
                        className="accent-visiblee-green-500"
                      />
                      <span className="flex-1 truncate font-mono text-xs">{p.siteUrl}</span>
                      {isMatch && (
                        <span className="rounded-full bg-visiblee-green-100 px-1.5 py-0.5 text-xs font-medium text-visiblee-green-700">
                          {t('matchProperty')}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
            <Button
              className="bg-visiblee-green-500 hover:bg-visiblee-green-600 text-white"
              onClick={handleSelectProperty}
              disabled={!selectedProperty || connecting}
            >
              {connecting && <Loader2 className="mr-2 size-4 animate-spin" />}
              {t('connectAndSyncButton')}
            </Button>
          </div>
        )}

        {/* ── State 3: Connected + property selected ── */}
        {status?.connected && status.propertyUrl && !isRevoked && (
          <div className="space-y-3">
            {isSyncing ? (
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <Loader2 className="size-4 animate-spin text-visiblee-green-500" />
                {t('syncing')}
              </div>
            ) : (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-zinc-500">{t('propertyLabel')}</dt>
                <dd className="truncate font-mono text-xs text-zinc-800">{status.propertyUrl}</dd>

                {status.lastSyncAt && (
                  <>
                    <dt className="text-zinc-500">{t('lastSyncLabel')}</dt>
                    <dd className="text-zinc-800">{formatRelativeTime(status.lastSyncAt, t)}</dd>
                  </>
                )}

                {status.queryCount > 0 && (
                  <>
                    <dt className="sr-only">Queries</dt>
                    <dd className="col-span-2 text-zinc-600">
                      {t('queriesImported', { count: status.queryCount })}
                    </dd>
                  </>
                )}

                {status.profileCount > 0 && (
                  <>
                    <dt className="sr-only">Profiles</dt>
                    <dd className="col-span-2 text-zinc-600">
                      {t('intentProfiles', { count: status.profileCount })}
                    </dd>
                  </>
                )}
              </dl>
            )}

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncNow}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1.5 size-3.5" />
                )}
                {t('syncNowButton')}
              </Button>

              <Dialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
                <DialogTrigger
                  className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-red-600"
                >
                  <Unlink className="size-3.5" />
                  {t('disconnectButton')}
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('disconnectConfirmTitle')}</DialogTitle>
                    <DialogDescription>{t('disconnectConfirmDescription')}</DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDisconnectOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleDisconnect}
                      disabled={disconnecting}
                    >
                      {disconnecting && <Loader2 className="mr-2 size-4 animate-spin" />}
                      {t('disconnectConfirm')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
