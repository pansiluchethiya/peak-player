'use client';
import { AdminShell, useAuthCheck } from '@/components/AdminShell';
import { Card } from 'fumadocs-ui/components/card';
import { buttonVariants } from 'fumadocs-ui/components/ui/button';
import { clsx } from 'clsx';
import { Cloud, RefreshCw, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

interface EnvInfo {
  port: number;
  defaultProviders: string[];
  febboxCookieCount: number;
  showboxCacheDir: string;
  nodeVersion: string;
  cookieStats: unknown;
}

const CONFIG_EXAMPLE =
  '{\n  "febboxCookies": [\n    "ui=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",\n    "ui=yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy"\n  ]\n}';

export default function FebboxPage() {
  const auth = useAuthCheck();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [env, setEnv] = useState<EnvInfo | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setStatus('loading');
      setError('');
      const res = await fetch('/api/debug/env');
      const data = await res.json();
      setEnv(data);
      setStatus('ready');
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Failed to load environment info');
    }
  };

  useEffect(() => { load(); }, []);

  if (auth === 'loading') return <AdminShell title="FebBox"><p className="admin-page-subtitle">Checking session...</p></AdminShell>;

  const cookieOk = env && env.febboxCookieCount > 0;

  return (
    <AdminShell title="FebBox">
      <div className="banner-stack" />
      <section className="page-status" aria-labelledby="title-febbox">
        <div className="page-head">
          <div>
            <p className="admin-eyebrow">Configure</p>
            <h1 id="title-febbox">FebBox cookies</h1>
            <p className="admin-page-subtitle">
              FebBox cookies are required for Showbox and PStream sources. Configure them via the
              <code style={{ margin: '0 4px', padding: '2px 6px', background: 'var(--color-fd-muted)', borderRadius: 4, fontSize: '0.8em' }}>FEBBOX_COOKIES</code>
              env var or the override file.
            </p>
          </div>
          <button type="button" className={clsx(buttonVariants({ variant: 'secondary' }), 'btn-sm')} onClick={load} disabled={status === 'loading'}>
            <RefreshCw className={status === 'loading' ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {error && <div className="alert danger" role="alert" style={{ marginTop: 16 }}><AlertCircle /> <span>{error}</span></div>}

        <Card title="Cookie status" description="FebBox cookie availability">
          <div className="provider-table">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Setting</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>FebBox cookies count</td>
                  <td>{env ? env.febboxCookieCount : '-'}</td>
                </tr>
                <tr>
                  <td>Status</td>
                  <td>
                    {cookieOk === true ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--color-success)' }}>
                        <CheckCircle size={14} /> Configured
                      </span>
                    ) : cookieOk === false ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--color-error)' }}>
                        <XCircle size={14} /> No cookies - Showbox/PStream unavailable
                      </span>
                    ) : '-'}
                  </td>
                </tr>
                <tr>
                  <td>Showbox cache dir</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{env?.showboxCacheDir ?? '-'}</td>
                </tr>
                <tr>
                  <td>Node version</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{env?.nodeVersion ?? '-'}</td>
                </tr>
                <tr>
                  <td>API port</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{env?.port ?? '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Configuration" description="How to set FebBox cookies" style={{ marginTop: 24 }}>
          <div style={{ padding: 16, borderRadius: 'var(--radius-sm)', background: 'var(--color-fd-muted)', fontSize: '0.8em', overflowX: 'auto' }}>
            <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '0.75em' }}>{CONFIG_EXAMPLE}</pre>
          </div>
          <p className="provider-check-hint" style={{ marginTop: 12 }}>
            Each cookie value should start with <code style={{ padding: '2px 6px', background: 'var(--color-fd-accent)', borderRadius: 3, fontSize: '0.8em' }}>ui=</code>.
            Add multiple cookies to distribute requests. Restart the API server after changes.
          </p>
        </Card>
      </section>
    </AdminShell>
  );
}
