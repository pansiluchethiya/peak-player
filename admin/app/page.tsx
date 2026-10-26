'use client';

import { AdminShell, useAuthCheck } from '@/components/AdminShell';
import { Card } from 'fumadocs-ui/components/card';
import { buttonVariants } from 'fumadocs-ui/components/ui/button';
import { TypeTable } from 'fumadocs-ui/components/type-table';
import { clsx } from 'clsx';
import { useCallback, useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import {
  Activity,
  Clock,
  Database,
  Server,
  RefreshCw,
  Play,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';

interface Metrics {
  uptimeSeconds?: number;
  requestsTotal?: number;
  streamRequests?: number;
  providerCalls?: Record<string, number>;
  streamsReturned?: number;
  tmdbToImdbLookups?: number;
  lastRequestAt?: number;
  memoryMB?: number;
  nodeVersion?: string;
  loadAvg?: number[];
  configDefaults?: { febboxCookies?: number };
}

interface ProviderStatus {
  name: string;
  enabled: boolean;
  cookieRequired: boolean;
  cookieOk: boolean;
}

interface StatusPayload {
  success?: boolean;
  providerCheckTmdbId?: string;
  metrics?: Metrics;
  providers?: ProviderStatus[];
}

const endpoints = {
  'GET /api/status': { type: '200 · application/json', description: 'Health snapshot & uptime.' },
  'GET /api/health': { type: '200 · application/json', description: 'Lightweight health check.' },
  'GET /api/metrics': { type: '200 · application/json', description: 'Rolling runtime metrics.' },
  'GET /api/v1/stream/:type/:id': { type: '200 · HLS m3u8', description: 'Validated stream URL.' },
};

function formatUptime(seconds?: number): string {
  if (!seconds || seconds < 0) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatRelative(timestamp?: number): string {
  if (!timestamp) return '—';
  const delta = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (delta < 5) return 'just now';
  if (delta < 60) return `${delta}s ago`;
  if (delta < 3600) return `${Math.round(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.round(delta / 3600)}h ago`;
  return `${Math.round(delta / 86400)}d ago`;
}

function formatNumber(value?: number): string {
  if (typeof value !== 'number') return '—';
  return value.toLocaleString();
}

export default function DashboardPage() {
  const auth = useAuthCheck();
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshedAt, setRefreshedAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/status', {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as StatusPayload;
      setStatus(data);
      setError(null);
      setRefreshedAt(Date.now());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (auth !== 'authenticated') return;
    void load();
    const timer = setInterval(() => void load(), 20000);
    return () => clearInterval(timer);
  }, [auth, load]);

  const metrics = status?.metrics;
  const providers = status?.providers ?? [];
  const enabledProviders = providers.filter((p) => p.enabled);
  const cookieIssues = enabledProviders.filter((p) => p.cookieRequired && !p.cookieOk);
  const providerCallTotal = Object.values(metrics?.providerCalls ?? {}).reduce(
    (sum, n) => sum + (Number(n) || 0),
    0,
  );

  const kpis: Array<{
    label: string;
    value: string;
    note: string;
    icon: ComponentType<{ className?: string }>;
  }> = [
    { label: 'Uptime', value: formatUptime(metrics?.uptimeSeconds), note: 'Since last restart', icon: Clock },
    { label: 'Requests', value: formatNumber(metrics?.requestsTotal), note: 'Total handled', icon: Activity },
    { label: 'Streams returned', value: formatNumber(metrics?.streamsReturned), note: 'Across all requests', icon: Server },
    { label: 'Memory', value: metrics?.memoryMB ? `${metrics.memoryMB} MB` : '—', note: 'Node process RSS', icon: Database },
  ];

  const readinessNote = providers.length
    ? `${enabledProviders.length} of ${providers.length} providers enabled`
    : 'Waiting for provider status';

  if (auth === 'loading') {
    return (
      <AdminShell title="Overview">
        <p className="admin-page-subtitle">Checking session…</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Overview">
      {error ? (
        <div className="admin-banner admin-banner-danger" role="alert">
          Could not reach the API: {error}
        </div>
      ) : null}

      <section className="page-status" aria-labelledby="title-status">
        <div className="page-head">
          <div>
            <p className="admin-eyebrow">Monitor</p>
            <h1 id="title-status">Overview</h1>
            <p className="admin-page-subtitle">
              A live read on your API, providers, and launch readiness.
            </p>
          </div>
          <div className="page-head-actions">
            <span className="admin-kpi-card" style={{ padding: '10px 14px' }}>
              <span className="admin-kpi-value" style={{ fontSize: '1.1rem' }}>
                {loading ? '—' : formatUptime(metrics?.uptimeSeconds)}
              </span>
              <span className="admin-kpi-note">{loading ? 'Refreshing' : 'Uptime'}</span>
            </span>
            <button
              type="button"
              className={clsx(buttonVariants({ variant: 'secondary' }), 'btn-sm')}
              id="refreshStatusBtn"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw />
              Refresh
            </button>
          </div>
        </div>

        {/* KPI grid */}
        <div className="admin-kpi-grid" aria-label="Key metrics">
          {kpis.map((k) => (
            <article key={k.label} className="admin-kpi-card">
              <div className="admin-kpi-label">
                <span className="admin-kpi-icon"><k.icon className="icon" /></span>
                <span>{k.label}</span>
              </div>
              <p className="admin-kpi-value" id={`kpi${k.label.replace(/\s/g, '')}`}>{k.value}</p>
              <p className="admin-kpi-note">{k.note}</p>
            </article>
          ))}
        </div>

        <div className="admin-dashboard-grid">
          <div className="admin-dashboard-primary">
            {/* Provider health */}
            <Card
              title="Provider health"
              description="Enablement, credentials, and live functional checks."
              className="provider-card"
            >
              <div className="provider-check-bar">
                <label>
                  Check title <span className="mono">TMDB ID</span>
                </label>
                <div className="inline-field">
                  <input
                    type="text"
                    inputMode="numeric"
                    defaultValue={status?.providerCheckTmdbId ?? '278'}
                    placeholder="278"
                  />
                  <button type="button" className={clsx(buttonVariants({ variant: 'secondary' }), 'btn-sm')}>
                    Save
                  </button>
                </div>
                <span className="provider-check-hint">
                  Default <span className="mono">278</span>. The provider matrix loads below.
                </span>
              </div>
              <div className="provider-table">
                {providers.length ? (
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th scope="col">Provider</th>
                        <th scope="col">Enabled</th>
                        <th scope="col">Credentials</th>
                      </tr>
                    </thead>
                    <tbody>
                      {providers.map((p) => (
                        <tr key={p.name}>
                          <td className="mono">{p.name}</td>
                          <td>{p.enabled ? 'Yes' : 'No'}</td>
                          <td>
                            {p.cookieRequired ? (p.cookieOk ? 'Cookies set' : 'Cookies missing') : 'Not required'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="admin-page-subtitle">Provider status will load here.</p>
                )}
              </div>
            </Card>

            {/* Endpoints */}
            <Card
              title="Endpoints"
              description="Copy a route to test it from your terminal."
              className="endpoints-card"
            >
              <TypeTable type={endpoints} />
            </Card>
          </div>

          <aside className="admin-gridrail" aria-label="Readiness and quick actions">
            {/* Readiness */}
            <Card title="Readiness" description="Launch check">
              <div className="readiness-list">
                <p>{readinessNote}.</p>
                <p>
                  {cookieIssues.length
                    ? `${cookieIssues.length} enabled provider${cookieIssues.length === 1 ? '' : 's'} still need cookies (${cookieIssues.map((p) => p.name).join(', ')}).`
                    : 'Every enabled provider has the credentials it needs.'}
                </p>
              </div>
              <p className="readiness-footnote">
                {refreshedAt ? `Checked ${formatRelative(refreshedAt)}` : 'Checking your configuration…'}
              </p>
            </Card>

            {/* Quick actions */}
            <Card title="Quick actions" description="Shortcuts">
              <div className="quick-actions">
                <button type="button" className="quick-action" onClick={() => void load()}>
                  <span className="quick-icon">{<RefreshCw />}</span>
                  <span><strong>Refresh status</strong><small>Pull the latest metrics</small></span>
                </button>
                <a
                  className="quick-action"
                  href="/providers"
                >
                  <span className="quick-icon">{<Play />}</span>
                  <span><strong>Run provider checks</strong><small>Test all enabled sources</small></span>
                </a>
                <a
                  className="quick-action"
                  href="http://localhost:3011/"
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="quick-icon">{<ExternalLink />}</span>
                  <span><strong>Open player</strong><small>Embed preview on :3011</small></span>
                </a>
              </div>
            </Card>

            {/* Activity */}
            <Card title="Activity" description="Runtime">
              <dl className="activity-list">
                <div><dt>Last request</dt><dd>{formatRelative(metrics?.lastRequestAt)}</dd></div>
                <div><dt>Stream requests</dt><dd>{formatNumber(metrics?.streamRequests)}</dd></div>
                <div><dt>Provider calls</dt><dd>{formatNumber(providerCallTotal)}</dd></div>
                <div><dt>TMDB ↔ IMDb</dt><dd>{formatNumber(metrics?.tmdbToImdbLookups)}</dd></div>
                <div><dt>Node runtime</dt><dd>{metrics?.nodeVersion ?? '—'}</dd></div>
              </dl>
              <p className="activity-refresh">
                Last refreshed {refreshedAt ? formatRelative(refreshedAt) : '—'}
              </p>
            </Card>
          </aside>
        </div>
      </section>

      <footer className="admin-footer">
        <ShieldCheck />
        <span>HMAC-SHA256 sessions · Local by design</span>
      </footer>
    </AdminShell>
  );
}
