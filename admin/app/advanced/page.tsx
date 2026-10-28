'use client';
import { AdminShell, useAuthCheck } from '@/components/AdminShell';
import { Card } from 'fumadocs-ui/components/card';
import { buttonVariants } from 'fumadocs-ui/components/ui/button';
import { clsx } from 'clsx';
import { Settings, Save, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ConfigResponse {
  merged: Record<string, unknown>;
  override: Record<string, unknown>;
  success: boolean;
}

export default function AdvancedPage() {
  const auth = useAuthCheck();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [config, setConfig] = useState<ConfigResponse['merged'] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [error, setError] = useState('');

  // Fields that can be edited
  const [port, setPort] = useState('');
  const [defaultProviders, setDefaultProviders] = useState('');
  const [defaultRegion, setDefaultRegion] = useState('');
  const [disableCache, setDisableCache] = useState(false);
  const [enablePStreamApi, setEnablePStreamApi] = useState(true);
  const [enableProxy, setEnableProxy] = useState(false);
  const [disableUrlValidation, setDisableUrlValidation] = useState(false);
  const [disable4khdhubUrlValidation, setDisable4khdhubUrlValidation] = useState(false);
  const [autoplay, setAutoplay] = useState(true);
  const [autoplayMuted, setAutoplayMuted] = useState(true);
  const [providerCheckTmdbId, setProviderCheckTmdbId] = useState('');

  const load = async () => {
    try {
      setStatus('loading');
      setError('');
      const res = await fetch('/api/config');
      const data: ConfigResponse = await res.json();
      setConfig(data.merged);
      const m = data.merged;
      setPort(m.port ? String(m.port) : '');
      setDefaultProviders(Array.isArray(m.defaultProviders) ? m.defaultProviders.join(', ') : '');
      setDefaultRegion(String(m.defaultRegion ?? ''));
      setDisableCache(m.disableCache === true);
      setEnablePStreamApi(m.enablePStreamApi !== false);
      setEnableProxy(m.enableProxy === true);
      setDisableUrlValidation(m.disableUrlValidation === true);
      setDisable4khdhubUrlValidation(m.disable4khdhubUrlValidation === true);
      setDisable4khdhubUrlValidation(m.disable4khdhubUrlValidation === true);
      setAutoplay(m.autoplay !== false);
      setAutoplayMuted(m.autoplayMuted !== false);
      setProviderCheckTmdbId(m.providerCheckTmdbId ? String(m.providerCheckTmdbId) : '278');
      setStatus('ready');
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Failed to load config');
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      const patch: Record<string, unknown> = {
        port: port ? Number(port) : undefined,
        defaultProviders: defaultProviders ? defaultProviders.split(/[\s,]+/).map(p => p.trim().toLowerCase()).filter(Boolean) : [],
        defaultRegion: defaultRegion || null,
        disableCache,
        enablePStreamApi,
        enableProxy,
        disableUrlValidation,
        disable4khdhubUrlValidation,
        autoplay,
        autoplayMuted,
        providerCheckTmdbId: providerCheckTmdbId || null,
      };
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const result = await res.json();
      if (result.success) {
        setSaveMsg('Configuration saved. Some changes may require a server restart.');
        setConfig(result.merged);
      } else {
        setError(result.error || 'Failed to save');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const toggle = (val: boolean, setter: (v: boolean) => void) => setter(!val);

  if (auth === 'loading') return <AdminShell title="Advanced"><p className="admin-page-subtitle">Checking session…</p></AdminShell>;

  return (
    <AdminShell title="Advanced">
      <div className="banner-stack" />
      <section className="page-status" aria-labelledby="title-advanced">
        <div className="page-head">
          <div>
            <p className="admin-eyebrow">System</p>
            <h1 id="title-advanced">Advanced configuration</h1>
            <p className="admin-page-subtitle">Server runtime settings and proxy configuration.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className={clsx(buttonVariants({ variant: 'secondary' }), 'btn-sm')} onClick={load} disabled={status === 'loading'}>
              <RefreshCw className={status === 'loading' ? 'animate-spin' : ''} /> Reload
            </button>
            <button type="button" className={clsx(buttonVariants(), 'btn-sm')} onClick={save} disabled={saving}>
              <Save size={14} /> {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {error && <div className="alert danger" role="alert" style={{ marginTop: 16 }}><AlertCircle /> <span>{error}</span></div>}
        {saveMsg && <div className="alert" role="status" style={{ marginTop: 16 }}><CheckCircle /> <span>{saveMsg}</span></div>}

        <Card title="Server settings" description="Port, defaults, and region">
          <div className="field">
            <label htmlFor="port">API port</label>
            <input id="port" type="number" min={1} max={65535} value={port} onChange={(e) => setPort(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="defaultProviders">Default providers</label>
            <input id="defaultProviders" type="text" value={defaultProviders} onChange={(e) => setDefaultProviders(e.target.value)} placeholder="e.g. showbox, pstream" />
          </div>
          <div className="field">
            <label htmlFor="defaultRegion">Default region</label>
            <input id="defaultRegion" type="text" value={defaultRegion} onChange={(e) => setDefaultRegion(e.target.value)} placeholder="e.g. US" />
          </div>
          <div className="field">
            <label htmlFor="providerCheckTmdbId">Provider check TMDB ID</label>
            <input id="providerCheckTmdbId" type="text" value={providerCheckTmdbId} onChange={(e) => setProviderCheckTmdbId(e.target.value)} />
          </div>
        </Card>

        <Card title="Behavior toggles" description="Caching, validation, and proxy" style={{ marginTop: 24 }}>
          <table className="admin-table">
            <thead>
              <tr><th>Setting</th><th>Value</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>Disable cache</td>
                <td>
                  <button type="button" className={clsx(buttonVariants({ variant: disableCache ? 'primary' : 'secondary' }), 'btn-sm')} onClick={() => toggle(disableCache, setDisableCache)}>
                    {disableCache ? 'On' : 'Off'}
                  </button>
                </td>
                <td>Cache stream lookups in memory</td>
              </tr>
              <tr>
                <td>Enable PStream API</td>
                <td>
                  <button type="button" className={clsx(buttonVariants({ variant: enablePStreamApi ? 'primary' : 'secondary' }), 'btn-sm')} onClick={() => toggle(enablePStreamApi, setEnablePStreamApi)}>
                    {enablePStreamApi ? 'On' : 'Off'}
                  </button>
                </td>
                <td>PStream provider API integration</td>
              </tr>
              <tr>
                <td>Enable proxy</td>
                <td>
                  <button type="button" className={clsx(buttonVariants({ variant: enableProxy ? 'primary' : 'secondary' }), 'btn-sm')} onClick={() => toggle(enableProxy, setEnableProxy)}>
                    {enableProxy ? 'On' : 'Off'}
                  </button>
                </td>
                <td>Proxy stream URLs through the API server</td>
              </tr>
              <tr>
                <td>Disable URL validation</td>
                <td>
                  <button type="button" className={clsx(buttonVariants({ variant: disableUrlValidation ? 'primary' : 'secondary' }), 'btn-sm')} onClick={() => toggle(disableUrlValidation, setDisableUrlValidation)}>
                    {disableUrlValidation ? 'On' : 'Off'}
                  </button>
                </td>
                <td>Skip source URL reachability checks</td>
              </tr>
              <tr>
                <td>Disable 4KHDHub URL validation</td>
                <td>
                  <button type="button" className={clsx(buttonVariants({ variant: disable4khdhubUrlValidation ? 'primary' : 'secondary' }), 'btn-sm')} onClick={() => toggle(disable4khdhubUrlValidation, setDisable4khdhubUrlValidation)}>
                    {disable4khdhubUrlValidation ? 'On' : 'Off'}
                  </button>
                </td>
                <td>Skip 4KHDHub-specific URL validation</td>
              </tr>
              <tr>
                <td>Autoplay</td>
                <td>
                  <button type="button" className={clsx(buttonVariants({ variant: autoplay ? 'primary' : 'secondary' }), 'btn-sm')} onClick={() => toggle(autoplay, setAutoplay)}>
                    {autoplay ? 'On' : 'Off'}
                  </button>
                </td>
                <td>Start playback automatically on supported browsers</td>
              </tr>
              <tr>
                <td>Start muted</td>
                <td>
                  <button type="button" disabled={autoplay} className={clsx(buttonVariants({ variant: autoplayMuted ? 'primary' : 'secondary' }), 'btn-sm')} onClick={() => toggle(autoplayMuted, setAutoplayMuted)}>
                    {autoplayMuted ? 'On' : 'Off'}
                  </button>
                </td>
                <td>Force muted autoplay (policy)</td>
              </tr>
            </tbody>
          </table>
        </Card>

        <Card title="Environment override" description="Current user-config.json" style={{ marginTop: 24 }}>
          <div style={{ padding: 16, borderRadius: 'var(--radius-sm)', background: 'var(--color-fd-muted)', fontSize: '0.8em', overflowX: 'auto', maxHeight: 200, overflow: 'auto' }}>
            <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '0.75em' }}>{JSON.stringify(config, null, 2)}</pre>
          </div>
        </Card>
      </section>
    </AdminShell>
  );
}
