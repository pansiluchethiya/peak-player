'use client';

import { useEffect, useState } from 'react';
import { Card } from 'fumadocs-ui/components/card';
import { buttonVariants } from 'fumadocs-ui/components/ui/button';
import { clsx } from 'clsx';
import { Plus, Trash2, RefreshCw, Globe, Clock, CheckCircle2, XCircle } from 'lucide-react';

export interface AdminProxy {
  id: string;
  name: string;
  upstreamUrl: string;
  headers: Record<string, string>;
  corsOrigins: string[];
  createdAt: string;
}

export interface ProxyHealth {
  name: string;
  healthy: boolean;
  latencyMs: number | null;
  errorCount: number;
}

export interface ProviderHealthRow {
  name: string;
  healthy: boolean;
  avgLatencyMs: number;
  errorCount: number;
}

export function ProxyManager() {
  const [proxies, setProxies] = useState<AdminProxy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    upstreamUrl: '',
    headers: '',
    corsOrigins: '',
  });
  const [health, setHealth] = useState<ProviderHealthRow[]>([]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [pRes, hRes] = await Promise.all([
        fetch('/api/admin/proxies', { headers: { Accept: 'application/json' }, cache: 'no-store' }),
        fetch('/api/v1/playback/health', { headers: { Accept: 'application/json' }, cache: 'no-store' }),
      ]);
      const pData = await pRes.json().catch(() => ({ success: false, proxies: [] }));
      const hData = await hRes.json().catch(() => ({ providers: [] }));
      setProxies(pData.proxies ?? []);
      setHealth(hData.providers?.map((p: any) => ({
        name: p.name,
        healthy: p.errorCount === 0,
        avgLatencyMs: p.avgLatencyMs ?? 0,
        errorCount: p.errorCount ?? 0,
      })) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load proxies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  async function revoke(id: string) {
    if (!confirm('Revoke this proxy?')) return;
    try {
      const res = await fetch(`/api/admin/proxies/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'revoke failed');
      setProxies((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to revoke proxy');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.upstreamUrl) {
      alert('Name and upstream URL are required');
      return;
    }
    let parsedHeaders: Record<string, string> = {};
    if (form.headers.trim()) {
      try {
        parsedHeaders = JSON.parse(form.headers);
      } catch {
        alert('Headers must be valid JSON');
        return;
      }
    }
    const corsOrigins = form.corsOrigins.split(',').map((s) => s.trim()).filter(Boolean);
    try {
      const res = await fetch('/api/admin/proxies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          upstreamUrl: form.upstreamUrl,
          headers: parsedHeaders,
          corsOrigins,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'create failed');
      setProxies((prev) => [data.proxy, ...prev]);
      setShowForm(false);
      setForm({ name: '', upstreamUrl: '', headers: '', corsOrigins: '' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create proxy');
    }
  }

  return (
    <div className="admin-proxies">
      <div className="page-head">
        <div>
          <p className="admin-eyebrow">Proxies</p>
          <h1>Proxy management</h1>
          <p className="admin-page-subtitle">
            Define proxy endpoints, monitor provider health, and manage CORS origins.
          </p>
        </div>
        <div className="page-head-actions">
          <button
            type="button"
            className={clsx(buttonVariants({ variant: 'secondary' }), 'btn-sm')}
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            type="button"
            className={clsx(buttonVariants({ variant: 'primary' }), 'btn-sm')}
            onClick={() => setShowForm(true)}
          >
            <Plus /> New proxy
          </button>
        </div>
      </div>

      {error && <div className="admin-banner admin-banner-danger" role="alert">{error}</div>}

      {/* Health dashboard */}
      <Card title="Provider health" description="Live health scores with latency and error count">
        {health.length === 0 ? (
          <p className="admin-page-subtitle">No provider health data yet.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Provider</th>
                <th scope="col">Status</th>
                <th scope="col">Latency</th>
                <th scope="col">Errors</th>
              </tr>
            </thead>
            <tbody>
              {health.map((p) => (
                <tr key={p.name}>
                  <td className="mono">{p.name}</td>
                  <td>
                    {p.healthy ? (
                      <span className="badge badge-ok"><CheckCircle2 className="icon-sm" /> Health</span>
                    ) : (
                      <span className="badge badge-dead"><XCircle className="icon-sm" /> Issues</span>
                    )}
                  </td>
                  <td>{p.avgLatencyMs ? `${p.avgLatencyMs} ms` : '—'}</td>
                  <td>{p.errorCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Proxies table */}
      {!showForm && (
        <Card title="Proxies" description="All configured proxy endpoints">
          {loading ? (
            <p className="admin-page-subtitle">Loading proxies…</p>
          ) : proxies.length === 0 ? (
            <p className="admin-page-subtitle">No proxies configured. Create one to get started.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Upstream</th>
                  <th scope="col">Headers</th>
                  <th scope="col">CORS origins</th>
                  <th scope="col">Created</th>
                  <th scope="col" className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {proxies.map((p) => (
                  <tr key={p.id}>
                    <td><strong>{p.name}</strong></td>
                    <td className="mono">{p.upstreamUrl}</td>
                    <td className="mono">{Object.keys(p.headers).length}</td>
                    <td className="mono">{p.corsOrigins.join(', ')}</td>
                    <td><Clock className="icon-sm inline" /> {new Date(p.createdAt).toLocaleString()}</td>
                    <td className="text-right">
                      <button
                        type="button"
                        className={clsx(buttonVariants({ variant: 'secondary' }), 'btn-sm', 'btn-icon')}
                        onClick={() => void revoke(p.id)}
                        aria-label={`Revoke ${p.name}`}
                      >
                        <Trash2 />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {showForm && (
        <Card title="Create proxy" description="Define a new proxy endpoint">
          <form onSubmit={handleSubmit} className="admin-form">
            <div className="field">
              <label>Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="My upstream proxy"
                required
              />
            </div>

            <div className="field">
              <label>Upstream URL</label>
              <Globe className="icon-sm" />
              <input
                type="url"
                value={form.upstreamUrl}
                onChange={(e) => setForm({ ...form, upstreamUrl: e.target.value })}
                placeholder="https://upstream.example.com"
                required
              />
            </div>

            <div className="field">
              <label>Headers (JSON)</label>
              <textarea
                value={form.headers}
                onChange={(e) => setForm({ ...form, headers: e.target.value })}
                placeholder='{"User-Agent": "Peak-Proxy/1.0"}'
                rows={3}
              />
            </div>

            <div className="field">
              <label>CORS origins (comma-separated)</label>
              <input
                type="text"
                value={form.corsOrigins}
                onChange={(e) => setForm({ ...form, corsOrigins: e.target.value })}
                placeholder="https://app.example.com, https://embed.example.com"
              />
            </div>

            <div className="form-actions">
              <button type="submit" className={clsx(buttonVariants({ variant: 'primary' }))}>
                Create
              </button>
              <button
                type="button"
                className={clsx(buttonVariants({ variant: 'secondary' }), 'btn-sm')}
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
