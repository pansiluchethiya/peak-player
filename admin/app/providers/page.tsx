'use client';
import { AdminShell, useAuthCheck } from '@/components/AdminShell';
import { Card } from 'fumadocs-ui/components/card';
import { buttonVariants } from 'fumadocs-ui/components/ui/button';
import { clsx } from 'clsx';
import { useEffect, useState } from 'react';
import { Server, RefreshCw, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface Provider {
  name: string;
  enabled: boolean;
}

interface StatusData {
  ok: boolean;
  providerCheckTmdbId: string;
  providers: Array<{ name: string; enabled: boolean; cookieRequired: boolean; cookieOk: boolean }>;
  metrics: { requestsTotal: number; streamRequests: number; streamsReturned: number };
}

export default function ProvidersPage() {
  const auth = useAuthCheck();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [data, setData] = useState<StatusData | null>(null);
  const [providersConfig, setProvidersConfig] = useState<{ enabledProviders: string[] } | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setStatus('loading');
      setError('');
      // Fetch provider list + status
      const statusRes = await fetch('/api/status');
      const statusData = await statusRes.json();
      if (!statusData.success) throw new Error(statusData.error || 'Failed to load status');
      setData(statusData);

      // Fetch config to know which providers are enabled
      const configRes = await fetch('/api/config');
      const configData = await configRes.json();
      setProvidersConfig({
        enabledProviders: configData.merged.defaultProviders,
      });
      setStatus('ready');
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Failed to load providers');
    }
  };

  useEffect(() => { load(); }, []);

  if (auth === 'loading') {
    return (
      <div className="admin-app" data-has-sidebar="true">
        <AdminShell title="Providers">
          <p className="admin-page-subtitle">Checking session…</p>
        </AdminShell>
      </div>
    );
  }

  return (
    <AdminShell title="Providers">
      <div className="banner-stack" />
      <section className="page-status" aria-labelledby="title-providers">
        <div className="page-head">
          <div>
            <p className="admin-eyebrow">Configure</p>
            <h1 id="title-providers">Providers &amp; defaults</h1>
            <p className="admin-page-subtitle">
              Enable or disable stream providers. Disabled sources won't be queried during playback.
            </p>
          </div>
          <button
            type="button"
            className={clsx(buttonVariants({ variant: 'secondary' }), 'btn-sm')}
            onClick={load}
            disabled={status === 'loading'}
          >
            <RefreshCw className={status === 'loading' ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {error && (
          <div className="alert danger" role="alert" style={{ marginTop: 16 }}>
            <AlertCircle /> <span>{error}</span>
          </div>
        )}

        <Card title="Provider matrix" description="Enabled sources and credential readiness">
          <div className="provider-table">
            {status === 'loading' ? (
              <p style={{ padding: '12px 0', color: 'var(--color-fd-muted-foreground)' }}>Loading providers…</p>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Provider</th>
                    <th>Status</th>
                    <th>Cookie required</th>
                    <th>Last used</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.providers.map((p) => (
                    <tr key={p.name}>
                      <td>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Server size={14} />
                          <strong>{p.name}</strong>
                        </span>
                      </td>
                      <td>
                        {p.enabled ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--color-success)' }}>
                            <CheckCircle size={14} /> Enabled
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--color-error)' }}>
                            <XCircle size={14} /> Disabled
                          </span>
                        )}
                      </td>
                      <td>
                        {p.cookieRequired ? (
                          p.cookieOk ? 'Available' : 'Missing'
                        ) : '—'}
                      </td>
                      <td style={{ color: 'var(--color-fd-muted-foreground)', fontSize: '0.8rem' }}>
                        —
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        <div className="admin-kpi-grid" style={{ marginTop: 24 }}>
          <div className="admin-kpi-card">
            <div className="admin-kpi-label">
              <span className="admin-kpi-icon"><Server size={20} /></span>
              <span>Total requests</span>
            </div>
            <p className="admin-kpi-value">{data?.metrics.requestsTotal ?? '—'}</p>
            <p className="admin-kpi-note">All-time since restart</p>
          </div>
          <div className="admin-kpi-card">
            <div className="admin-kpi-label">
              <span className="admin-kpi-icon"><Server size={20} /></span>
              <span>Stream requests</span>
            </div>
            <p className="admin-kpi-value">{data?.metrics.streamRequests ?? '—'}</p>
            <p className="admin-kpi-note">Resolved streams</p>
          </div>
          <div className="admin-kpi-card">
            <div className="admin-kpi-label">
              <span className="admin-kpi-icon"><Server size={20} /></span>
              <span>Sources returned</span>
            </div>
            <p className="admin-kpi-value">{data?.metrics.streamsReturned ?? '—'}</p>
            <p className="admin-kpi-note">Aggregated across providers</p>
          </div>
        </div>
      </section>
    </AdminShell>
  );
}
