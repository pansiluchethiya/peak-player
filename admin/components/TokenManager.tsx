'use client';

import { useEffect, useState } from 'react';
import { Card } from 'fumadocs-ui/components/card';
import { buttonVariants } from 'fumadocs-ui/components/ui/button';
import { clsx } from 'clsx';
import { Plus, Trash2, RefreshCw, Clock, Shield, Key, Globe } from 'lucide-react';

export interface AdminToken {
  id: string;
  name: string;
  partner: string;
  expiresAt: string;
  allowedOrigins: string[];
  readOnly: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface TokenStats {
  sessionsMinted: number;
  requestsServed: number;
}

const EXPIRY_OPTIONS = [
  { label: '1 hour', value: 3600 },
  { label: '6 hours', value: 21600 },
  { label: '12 hours', value: 43200 },
  { label: '24 hours', value: 86400 },
];

export function TokenManager() {
  const [tokens, setTokens] = useState<AdminToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    partner: 'default',
    expirySeconds: 3600,
    allowedOrigins: '',
    readOnly: false,
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/tokens', { headers: { Accept: 'application/json' }, cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { success?: boolean; tokens?: AdminToken[] };
      if (!data.success) throw new Error('API error');
      setTokens(data.tokens ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tokens');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  async function revoke(id: string) {
    if (!confirm('Revoke this token? It will be immediately invalidated.')) return;
    try {
      const res = await fetch(`/api/admin/tokens/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'revoke failed');
      setTokens((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to revoke token');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const origins = form.allowedOrigins
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!origins.length) {
      alert('Add at least one allowed origin');
      return;
    }
    const expiresAt = new Date(Date.now() + form.expirySeconds * 1000).toISOString();
    try {
      const res = await fetch('/api/admin/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          partner: form.partner,
          expiresAt,
          allowedOrigins: origins,
          readOnly: form.readOnly,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'create failed');
      setTokens((prev) => [data.token, ...prev]);
      setShowForm(false);
      setForm({
        name: '',
        partner: 'default',
        expirySeconds: 3600,
        allowedOrigins: '',
        readOnly: false,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create token');
    }
  }

  const now = Date.now();
  const isExpired = (t: AdminToken) => new Date(t.expiresAt).getTime() < now;

  return (
    <div className="admin-tokens">
      <div className="page-head">
        <div>
          <p className="admin-eyebrow">Tokens</p>
          <h1>Embed tokens</h1>
          <p className="admin-page-subtitle">
            Manage signed embed token definitions. Tokens control which partners can mint sessions and from which exact origins.
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
            <Plus /> New token
          </button>
        </div>
      </div>

      {error && <div className="admin-banner admin-banner-danger" role="alert">{error}</div>}

      {!showForm && (
        <Card title="Tokens" description="All active and expired token definitions">
          {loading ? (
            <p className="admin-page-subtitle">Loading tokens…</p>
          ) : tokens.length === 0 ? (
            <p className="admin-page-subtitle">No tokens configured. Create one to get started.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Partner</th>
                  <th scope="col">Expires</th>
                  <th scope="col">Status</th>
                  <th scope="col">Allowed origins</th>
                  <th scope="col">Last used</th>
                  <th scope="col" className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((t) => {
                  const expired = isExpired(t);
                  return (
                    <tr key={t.id}>
                      <td>
                        <strong>{t.name}</strong>
                        {t.readOnly ? <Shield className="icon-sm text-fd-muted-foreground" /> : null}
                      </td>
                      <td className="mono">{t.partner}</td>
                      <td>
                        <Clock className="icon-sm inline" />{' '}
                        {new Date(t.expiresAt).toLocaleString()}
                      </td>
                      <td>
                        <span className={`badge ${expired ? 'badge-dead' : 'badge-ok'}`}>
                          {expired ? 'Expired' : 'Active'}
                        </span>
                      </td>
                      <td className="mono">{t.allowedOrigins.join(', ')}</td>
                      <td>{t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleString() : '—'}</td>
                      <td className="text-right">
                        <button
                          type="button"
                          className={clsx(buttonVariants({ variant: 'secondary' }), 'btn-sm', 'btn-icon')}
                          onClick={() => void revoke(t.id)}
                          aria-label={`Revoke ${t.name}`}
                        >
                          <Trash2 />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {showForm && (
        <Card title="Create token" description="Mint a new embed token definition">
          <form onSubmit={handleSubmit} className="admin-form">
            <div className="field">
              <label>Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="My partner token"
                required
              />
            </div>

            <div className="field">
              <label>Partner ID</label>
              <input
                type="text"
                value={form.partner}
                onChange={(e) => setForm({ ...form, partner: e.target.value })}
                required
              />
            </div>

            <div className="field">
              <label>Expiry</label>
              <select
                value={form.expirySeconds}
                onChange={(e) => setForm({ ...form, expirySeconds: Number(e.target.value) })}
              >
                {EXPIRY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <small>60s – 24h as per spec §7.</small>
            </div>

            <div className="field">
              <label>Allowed origins (comma-separated)</label>
              <input
                type="text"
                value={form.allowedOrigins}
                onChange={(e) => setForm({ ...form, allowedOrigins: e.target.value })}
                placeholder="https://app.example.com, https://embed.example.com"
                required
              />
            </div>

            <div className="field">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={form.readOnly}
                  onChange={(e) => setForm({ ...form, readOnly: e.target.checked })}
                />
                <span>Read-only</span>
              </label>
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
