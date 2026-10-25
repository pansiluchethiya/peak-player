'use client';
import { AdminShell, useAuthCheck } from '@/components/AdminShell';
import { Card } from 'fumadocs-ui/components/card';
import { buttonVariants } from 'fumadocs-ui/components/ui/button';
import { clsx } from 'clsx';
import { Sliders, Save, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ConfigResponse {
  merged: {
    defaultProviders: string[];
    minQualitiesRaw: string | null;
    excludeCodecsRaw: string | null;
    minQualities: Record<string, number> | null;
    excludeCodecs: Record<string, boolean> | null;
  };
  override: Record<string, unknown>;
}

export default function QualityPage() {
  const auth = useAuthCheck();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [config, setConfig] = useState<ConfigResponse['merged'] | null>(null);
  const [minQualitiesRaw, setMinQualitiesRaw] = useState('');
  const [excludeCodecsRaw, setExcludeCodecsRaw] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setStatus('loading');
      setError('');
      const res = await fetch('/api/config');
      const data = await res.json();
      setConfig(data.merged);
      setMinQualitiesRaw(data.merged.minQualitiesRaw ?? '');
      setExcludeCodecsRaw(data.merged.excludeCodecsRaw ?? '');
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
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defaultProviders: config?.defaultProviders ?? [],
          minQualitiesRaw,
          excludeCodecsRaw,
        }),
      });
      const result = await res.json();
      if (result.success) {
        setSaveMsg('Settings saved. Restart may be required for some changes to take effect.');
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

  if (auth === 'loading') return <AdminShell title="Quality"><p className="admin-page-subtitle">Checking session…</p></AdminShell>;

  return (
    <AdminShell title="Quality &amp; filters">
      <div className="banner-stack" />
      <section className="page-status" aria-labelledby="title-quality">
        <div className="page-head">
          <div>
            <p className="admin-eyebrow">Configure</p>
            <h1 id="title-quality">Quality &amp; filters</h1>
            <p className="admin-page-subtitle">Set quality floors and codec exclusion rules.</p>
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

        <Card title="Quality floors" description="Minimum quality thresholds per provider (JSON)">
          <div className="field" style={{ marginBottom: 12 }}>
            <label htmlFor="minQualitiesRaw">minQualitiesRaw</label>
            <textarea
              id="minQualitiesRaw"
              value={minQualitiesRaw}
              onChange={(e) => setMinQualitiesRaw(e.target.value)}
              placeholder='e.g. {"showbox": 720, "default": 480}'
              rows={4}
              style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
            />
          </div>
          <p className="provider-check-hint">
            Maps provider names to a minimum height in pixels. Streams below this quality are filtered out.
          </p>
        </Card>

        <Card title="Codec exclusion" description="Exclude specific codecs per provider (JSON)" style={{ marginTop: 24 }}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label htmlFor="excludeCodecsRaw">excludeCodecsRaw</label>
            <textarea
              id="excludeCodecsRaw"
              value={excludeCodecsRaw}
              onChange={(e) => setExcludeCodecsRaw(e.target.value)}
              placeholder='e.g. {"showbox": {"hevc": true}}'
              rows={4}
              style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
            />
          </div>
          <p className="provider-check-hint">
            Maps provider names to codec filter flags. Set a codec key to true to exclude it.
          </p>
        </Card>
      </section>
    </AdminShell>
  );
}
