'use client';
import { AdminShell, useAuthCheck } from '@/components/AdminShell';
import { Card } from 'fumadocs-ui/components/card';
import { buttonVariants } from 'fumadocs-ui/components/ui/button';
import { clsx } from 'clsx';
import { Key, Plus, RefreshCw, AlertCircle, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';

// API keys are managed via the user-config.json override file.
// The /api/config endpoint returns the full merged config including tmdbApiKeys.
interface ConfigResponse {
  merged: {
    tmdbApiKeys: string[];
    tmdbApiKey?: string | null;
  };
}

const KEYS_EXAMPLE = '{\n  "tmdbApiKeys": ["your-tmdb-api-key-here"]\n}';

export default function KeysPage() {
  const auth = useAuthCheck();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [apiKeys, setApiKeys] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const load = async () => {
    try {
      setStatus('loading');
      setError('');
      const res = await fetch('/api/config');
      const data: ConfigResponse = await res.json();
      setApiKeys(data.merged.tmdbApiKeys ?? (data.merged.tmdbApiKey ? [data.merged.tmdbApiKey] : []));
      setStatus('ready');
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Failed to load API keys');
    }
  };

  useEffect(() => { load(); }, []);

  if (auth === 'loading') return <AdminShell title="API Keys"><p className="admin-page-subtitle">Checking session…</p></AdminShell>;

  return (
    <AdminShell title="API keys">
      <div className="banner-stack" />
      <section className="page-status" aria-labelledby="title-keys">
        <div className="page-head">
          <div>
            <p className="admin-eyebrow">Configure</p>
            <h1 id="title-keys">API keys</h1>
            <p className="admin-page-subtitle">
              TMDB API keys used for movie/TV metadata lookups. These are stored in your
              <code style={{ margin: '0 4px', padding: '2px 6px', background: 'var(--color-fd-muted)', borderRadius: 4, fontSize: '0.8em' }}>utils/user-config.json</code>
              override file.
            </p>
          </div>
          <button type="button" className={clsx(buttonVariants({ variant: 'secondary' }), 'btn-sm')} onClick={load} disabled={status === 'loading'}>
            <RefreshCw className={status === 'loading' ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {error && <div className="alert danger" role="alert" style={{ marginTop: 16 }}><AlertCircle /> <span>{error}</span></div>}

        <Card title="TMDB API keys" description="Configured keys (masked)">
          {status === 'loading' ? (
            <p style={{ padding: '12px 0', color: 'var(--color-fd-muted-foreground)' }}>Loading…</p>
          ) : apiKeys.length === 0 ? (
            <p style={{ padding: '12px 0', color: 'var(--color-fd-muted-foreground)' }}>No API keys configured. Add keys to your user-config.json override file:</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Key (masked)</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {apiKeys.map((key, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td><code style={{ fontFamily: 'var(--font-mono)' }}>{maskKey(key)}</code></td>
                    <td>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={async () => {
                          await navigator.clipboard.writeText(key);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        title="Copy to clipboard"
                      >
                        <Copy size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div style={{ marginTop: 16, padding: 16, borderRadius: 'var(--radius-sm)', background: 'var(--color-fd-muted)', fontSize: '0.8em' }}>
            <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '0.75em' }}>{KEYS_EXAMPLE}</pre>
          </div>
        </Card>
      </section>
    </AdminShell>
  );
}

function maskKey(key: string): string {
  if (key.length <= 8) return '•••';
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}
