'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useFormatter } from 'next-intl';
import {
  Users,
  Search,
  RefreshCw,
  Loader2,
  CheckCircle2,
  ExternalLink,
  Monitor,
  Smartphone,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StepLoader } from '@/components/ui/step-loader';
import { useJobPolling } from '@/hooks/use-job-polling';
import { cn } from '@/lib/utils';

interface IntentProfile {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  source: string;
  dominantIntent: string;
  dominantDevice: string | null;
  dominantCountry: string | null;
  avgQueryLength: number;
  queryCount: number;
  totalImpressions: number;
  topPatterns: string[];
  sampleQueries: string[];
  citedCount?: number;
  totalTargetQueries?: number;
}

interface GscConnectionInfo {
  propertyUrl: string | null;
  lastSyncAt: string | null;
  status: string;
  pendingJobId: string | null;
  queryCount: number;
}

interface AudienceInsightsPageProps {
  projectId: string;
  gscConnection: GscConnectionInfo | null;
  intentProfiles: IntentProfile[];
  totalImpressions: number;
}

// ── Add manual persona form ───────────────────────────────────────────────────

interface AddPersonaFormProps {
  projectId: string;
  onCreated: () => void;
  onCancel: () => void;
}

function AddPersonaForm({ projectId, onCreated, onCancel }: AddPersonaFormProps) {
  const t = useTranslations('gsc.audience');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [queriesRaw, setQueriesRaw] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const sampleQueries = queriesRaw
      .split('\n')
      .map((q) => q.trim())
      .filter(Boolean);

    if (!name.trim() || !description.trim() || sampleQueries.length === 0) {
      setError('All fields are required and at least one example query is needed.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/intent-profiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim(), sampleQueries }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? 'Failed to create persona');
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900">{t('addManualTitle')}</h3>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
        >
          <X className="size-4" />
        </button>
      </div>
      <p className="mb-4 text-xs text-zinc-500">{t('addManualSubtitle')}</p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-700">
            {t('formNameLabel')}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('formNamePlaceholder')}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
            disabled={submitting}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-700">
            {t('formDescriptionLabel')}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('formDescriptionPlaceholder')}
            rows={2}
            className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
            disabled={submitting}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-700">
            {t('formQueriesLabel')}
          </label>
          <p className="mb-1.5 text-xs text-zinc-400">{t('formQueriesHelp')}</p>
          <textarea
            value={queriesRaw}
            onChange={(e) => setQueriesRaw(e.target.value)}
            placeholder={t('formQueriesPlaceholder')}
            rows={3}
            className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
            disabled={submitting}
          />
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={submitting}>
            {t('formCancel')}
          </Button>
          <Button type="submit" size="sm" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                {t('formSubmitting')}
              </>
            ) : (
              t('formSubmit')
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

// ── State 1: not connected ────────────────────────────────────────────────────

const STATIC_PROFILES = [
  { key: 'profileResearcher', descKey: 'profileResearcherDesc' },
  { key: 'profileEvaluator', descKey: 'profileEvaluatorDesc' },
  { key: 'profileDecisionMaker', descKey: 'profileDecisionMakerDesc' },
  { key: 'profileAiExplorer', descKey: 'profileAiExplorerDesc' },
] as const;

function AudienceInsightsEmpty({
  projectId,
  manualProfiles,
}: {
  projectId: string;
  manualProfiles: IntentProfile[];
}) {
  const t = useTranslations('gsc.audience');
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">{t('pageTitle')}</h1>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <div className="mb-4 flex flex-col items-center gap-2 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-zinc-100">
            <Users className="size-7 text-zinc-400" />
          </div>
          <h2 className="text-lg font-semibold text-zinc-900">{t('emptyTitle')}</h2>
          <p className="text-sm text-zinc-500">{t('emptySubtitle')}</p>
        </div>

        <p className="mb-3 text-sm text-zinc-600">{t('emptyDescription')}</p>
        <p className="mb-4 text-sm text-zinc-600">{t('emptyExplainer')}</p>

        {/* Static profile previews */}
        <div className="mb-5 divide-y divide-zinc-100 rounded-xl border border-dashed border-zinc-200 opacity-60">
          {STATIC_PROFILES.map(({ key, descKey }) => (
            <div key={key} className="flex items-start gap-3 px-4 py-3">
              <Users className="mt-0.5 size-4 shrink-0 text-zinc-400" />
              <div>
                <p className="text-sm font-medium text-zinc-700">{t(key)}</p>
                <p className="text-xs text-zinc-500">{t(descKey)}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center gap-2">
          <Button
            className="bg-visiblee-green-500 hover:bg-visiblee-green-600 text-white"
            onClick={() => {
              window.location.href = `/api/gsc/connect?projectId=${projectId}`;
            }}
          >
            <ExternalLink className="mr-2 size-4" />
            {t('emptyConnectButton')}
          </Button>
          <p className="text-xs text-zinc-400">{t('emptyTimeNote')}</p>
        </div>
      </div>

      {/* Manual personas section — available even without GSC */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">{t('manualPersonasTitle')}</h2>
            <p className="text-xs text-zinc-500">{t('emptyManualSection')}</p>
          </div>
          {!showForm && (
            <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
              <Plus className="mr-1.5 size-3.5" />
              {t('addManualButton')}
            </Button>
          )}
        </div>

        {showForm && (
          <AddPersonaForm
            projectId={projectId}
            onCreated={() => {
              setShowForm(false);
              router.refresh();
            }}
            onCancel={() => setShowForm(false)}
          />
        )}

        {manualProfiles.length > 0 && (
          <div className="mt-3 space-y-3">
            {manualProfiles.map((p) => (
              <ManualProfileCard key={p.id} profile={p} projectId={projectId} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── State 2a: syncing ─────────────────────────────────────────────────────────

function AudienceInsightsSyncing({ projectId, jobId }: { projectId: string; jobId: string }) {
  const t = useTranslations('gsc.audience');
  const router = useRouter();

  useJobPolling({
    active: true,
    url: `/api/gsc/status?projectId=${projectId}`,
    isDone: (data) => !(data as { pendingJobId: string | null }).pendingJobId,
    onDone: () => router.refresh(),
    interval: 4000,
  });

  const steps = [
    { icon: Search, label: t('syncStep1') },
    { icon: RefreshCw, label: t('syncStep2') },
    { icon: Users, label: t('syncStep3') },
    { icon: Users, label: t('syncStep4') },
    { icon: CheckCircle2, label: t('syncStep5') },
  ];

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-xl font-semibold text-zinc-900">{t('pageTitle')}</h1>
      <StepLoader
        title={t('syncingTitle')}
        subtitle={t('syncingSubtitle')}
        steps={steps}
        skeleton="content-rows"
      />
    </div>
  );
}

// ── State 2b: no data ─────────────────────────────────────────────────────────

function AudienceInsightsNoData({
  projectId,
  lastSyncAt,
  manualProfiles,
}: {
  projectId: string;
  lastSyncAt: string | null;
  manualProfiles: IntentProfile[];
}) {
  const t = useTranslations('gsc.audience');
  const format = useFormatter();
  const [syncing, setSyncing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const router = useRouter();

  async function handleSync() {
    setSyncing(true);
    await fetch('/api/gsc/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId }),
    });
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-xl font-semibold text-zinc-900">{t('pageTitle')}</h1>
      <div className="rounded-xl border border-zinc-200 bg-white p-6 text-center">
        <div className="mb-3 flex justify-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-zinc-100">
            <Users className="size-6 text-zinc-400" />
          </div>
        </div>
        <h2 className="mb-2 text-base font-semibold text-zinc-800">{t('noDataTitle')}</h2>
        <p className="mb-4 text-sm text-zinc-500">{t('noDataDescription')}</p>
        {lastSyncAt && (
          <p className="mb-4 text-xs text-zinc-400">
            {t('lastSync', {
              date: format.dateTime(new Date(lastSyncAt), { day: 'numeric', month: 'short', year: 'numeric' }),
            })}
          </p>
        )}
        <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
          {syncing ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
          {t('syncNow')}
        </Button>
      </div>

      {/* Manual personas section */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">{t('manualPersonasTitle')}</h2>
          {!showForm && (
            <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
              <Plus className="mr-1.5 size-3.5" />
              {t('addManualButton')}
            </Button>
          )}
        </div>

        {showForm && (
          <AddPersonaForm
            projectId={projectId}
            onCreated={() => {
              setShowForm(false);
              router.refresh();
            }}
            onCancel={() => setShowForm(false)}
          />
        )}

        {manualProfiles.length > 0 ? (
          <div className="mt-3 space-y-3">
            {manualProfiles.map((p) => (
              <ManualProfileCard key={p.id} profile={p} projectId={projectId} />
            ))}
          </div>
        ) : (
          !showForm && (
            <p className="text-xs text-zinc-400">{t('manualPersonasEmpty')}</p>
          )
        )}
      </div>
    </div>
  );
}

// ── Manual profile card (deletable) ──────────────────────────────────────────

function ManualProfileCard({
  profile,
  projectId,
}: {
  profile: IntentProfile;
  projectId: string;
}) {
  const t = useTranslations('gsc.audience');
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(t('deleteConfirm'))) return;
    setDeleting(true);
    await fetch(`/api/projects/${projectId}/intent-profiles/${profile.id}`, {
      method: 'DELETE',
    });
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <div className="flex size-8 items-center justify-center rounded-full bg-purple-100">
            <Users className="size-4 text-purple-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-zinc-900">{profile.name}</p>
              <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-600">
                {t('manualBadge')}
              </span>
            </div>
            {profile.description && (
              <p className="mt-0.5 text-xs text-zinc-500">{profile.description}</p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="shrink-0 rounded-md p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
          title={t('deleteButton')}
        >
          {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        </button>
      </div>
      {profile.sampleQueries.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(profile.sampleQueries as string[]).slice(0, 3).map((q) => (
            <span
              key={q}
              className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 italic"
            >
              "{q}"
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── State 3: profiles available ───────────────────────────────────────────────

function IntentProfileCard({
  profile,
  totalImpressions,
  projectId,
}: {
  profile: IntentProfile;
  totalImpressions: number;
  projectId: string;
}) {
  const t = useTranslations('gsc.audience');
  const trafficPct =
    totalImpressions > 0 ? Math.round((profile.totalImpressions / totalImpressions) * 100) : 0;
  const citedCount = profile.citedCount ?? 0;
  const totalTQ = profile.totalTargetQueries ?? 0;
  const citedPct = totalTQ > 0 ? Math.round((citedCount / totalTQ) * 100) : 0;

  if (profile.source === 'manual') {
    return <ManualProfileCard profile={profile} projectId={projectId} />;
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-full bg-zinc-100">
            <Users className="size-4 text-zinc-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-900">{profile.name}</p>
            {profile.description && (
              <p className="text-xs text-zinc-500">{profile.description}</p>
            )}
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
          {t('trafficShare', { pct: trafficPct })}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <dt className="text-zinc-400">{t('intentLabel')}</dt>
        <dd className="font-medium capitalize text-zinc-700">{profile.dominantIntent}</dd>

        {profile.dominantDevice && (
          <>
            <dt className="text-zinc-400">{t('deviceLabel')}</dt>
            <dd className="flex items-center gap-1 text-zinc-700">
              {profile.dominantDevice === 'MOBILE' ? (
                <Smartphone className="size-3 text-zinc-400" />
              ) : (
                <Monitor className="size-3 text-zinc-400" />
              )}
              {profile.dominantDevice.toLowerCase()}
            </dd>
          </>
        )}

        {profile.topPatterns.length > 0 && (
          <>
            <dt className="text-zinc-400">{t('patternLabel')}</dt>
            <dd className="text-zinc-700">{profile.topPatterns.join(', ')}</dd>
          </>
        )}

        {profile.sampleQueries.length > 0 && (
          <>
            <dt className="text-zinc-400">{t('sampleQueryLabel')}</dt>
            <dd className="truncate text-zinc-700 italic">"{profile.sampleQueries[0]}"</dd>
          </>
        )}
      </dl>

      {/* Citation impact bar */}
      {totalTQ > 0 && (
        <div className="mt-3 border-t border-zinc-100 pt-3">
          <p className="mb-1.5 text-xs font-medium text-zinc-500">{t('citationImpact')}</p>
          <div className="mb-1 flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
              <div
                className={cn(
                  'h-full rounded-full',
                  citedPct >= 60
                    ? 'bg-green-400'
                    : citedPct >= 30
                      ? 'bg-amber-400'
                      : 'bg-red-300',
                )}
                style={{ width: `${citedPct}%` }}
              />
            </div>
            <span className="shrink-0 text-xs font-medium text-zinc-600">{citedPct}%</span>
          </div>
          <p className="text-xs text-zinc-400">
            {t('citedQueries', { cited: citedCount, total: totalTQ })}
          </p>
        </div>
      )}
    </div>
  );
}

function AudienceInsightsProfiles({
  projectId,
  profiles,
  totalImpressions,
  lastSyncAt,
}: {
  projectId: string;
  profiles: IntentProfile[];
  totalImpressions: number;
  lastSyncAt: string | null;
}) {
  const t = useTranslations('gsc.audience');
  const format = useFormatter();
  const [syncing, setSyncing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const router = useRouter();

  const gscProfiles = profiles.filter((p) => p.source === 'gsc');
  const manualProfiles = profiles.filter((p) => p.source === 'manual');

  async function handleSync() {
    setSyncing(true);
    await fetch('/api/gsc/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId }),
    });
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-zinc-900">{t('pageTitle')}</h1>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
          {t('poweredByGsc')}
        </span>
      </div>

      {/* GSC profiles */}
      {gscProfiles.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-zinc-700">
            {t('profilesTitle', { count: gscProfiles.length })}
          </p>
          {gscProfiles.map((p) => (
            <IntentProfileCard
              key={p.id}
              profile={p}
              totalImpressions={totalImpressions}
              projectId={projectId}
            />
          ))}
        </div>
      )}

      {/* Manual personas section */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">{t('manualPersonasTitle')}</h2>
          {!showForm && (
            <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
              <Plus className="mr-1.5 size-3.5" />
              {t('addManualButton')}
            </Button>
          )}
        </div>

        {showForm && (
          <AddPersonaForm
            projectId={projectId}
            onCreated={() => {
              setShowForm(false);
              router.refresh();
            }}
            onCancel={() => setShowForm(false)}
          />
        )}

        {manualProfiles.length > 0 ? (
          <div className="space-y-3">
            {manualProfiles.map((p) => (
              <ManualProfileCard key={p.id} profile={p} projectId={projectId} />
            ))}
          </div>
        ) : (
          !showForm && (
            <p className="text-xs text-zinc-400">{t('manualPersonasEmpty')}</p>
          )
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-zinc-400">
        {lastSyncAt && (
          <span>
            {t('lastSync', {
              date: format.dateTime(new Date(lastSyncAt), {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              }),
            })}
          </span>
        )}
        <Button variant="ghost" size="sm" onClick={handleSync} disabled={syncing}>
          {syncing ? <Loader2 className="mr-1.5 size-3 animate-spin" /> : <RefreshCw className="mr-1.5 size-3" />}
          {t('syncNow')}
        </Button>
      </div>
    </div>
  );
}

// ── Main dispatcher ───────────────────────────────────────────────────────────

export function AudienceInsightsPage({
  projectId,
  gscConnection,
  intentProfiles,
  totalImpressions,
}: AudienceInsightsPageProps) {
  const isConnected = gscConnection?.status === 'active';
  const hasPendingJob = !!gscConnection?.pendingJobId;
  const manualProfiles = intentProfiles.filter((p) => p.source === 'manual');
  const gscProfiles = intentProfiles.filter((p) => p.source === 'gsc');

  if (!isConnected) {
    return <AudienceInsightsEmpty projectId={projectId} manualProfiles={manualProfiles} />;
  }

  if (hasPendingJob) {
    return <AudienceInsightsSyncing projectId={projectId} jobId={gscConnection.pendingJobId!} />;
  }

  if (gscProfiles.length === 0) {
    return (
      <AudienceInsightsNoData
        projectId={projectId}
        lastSyncAt={gscConnection.lastSyncAt}
        manualProfiles={manualProfiles}
      />
    );
  }

  return (
    <AudienceInsightsProfiles
      projectId={projectId}
      profiles={intentProfiles}
      totalImpressions={totalImpressions}
      lastSyncAt={gscConnection.lastSyncAt}
    />
  );
}
