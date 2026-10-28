'use client';
import { AdminShell, useAuthCheck } from '@/components/AdminShell';
import { Card } from 'fumadocs-ui/components/card';
import { buttonVariants } from 'fumadocs-ui/components/ui/button';
import { clsx } from 'clsx';
import { Check, X, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FEATURE_DEFS, type FeatureDef } from '@/components/FeatureToggle';

interface FeatureState extends FeatureDef {
  enabled: boolean;
}

export default function FeaturesPage() {
  const auth = useAuthCheck();
  const [features, setFeatures] = useState<FeatureState[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/features', {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { success?: boolean; features?: FeatureState[] };
      if (!data.success) throw new Error('API error');
      setFeatures(data.features ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load features');
      setFeatures(FEATURE_DEFS.map((f) => ({ ...f, enabled: false })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  async function toggleAll(enabled: boolean) {
    setSaving(true);
    try {
      const patch: Record<string, boolean> = {};
      features.forEach((f) => { patch[f.key] = enabled; });
      const res = await fetch('/api/admin/features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (data.success) {
        setFeatures((prev) => prev.map((f) => ({ ...f, enabled })));
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  const enabledCount = features.filter((f) => f.enabled).length;

  if (auth === 'loading') {
    return (
      <AdminShell title="Features">
        <p className="admin-page-subtitle">Checking session…</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Features">
      <div className="admin-features">
        <div className="page-head">
          <div>
            <p className="admin-eyebrow">Features</p>
            <h1>Feature toggles</h1>
            <p className="admin-page-subtitle">
              {loading ? 'Loading…' : `${enabledCount} of ${features.length} features enabled`}
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
              onClick={() => void toggleAll(true)}
              disabled={saving || loading}
            >
              <Check /> Enable all
            </button>
            <button
              type="button"
              className={clsx(buttonVariants({ variant: 'secondary' }), 'btn-sm')}
              onClick={() => void toggleAll(false)}
              disabled={saving || loading}
            >
              <X /> Disable all
            </button>
          </div>
        </div>

        {error && <div className="admin-banner admin-banner-danger" role="alert">{error}</div>}

        {loading ? (
          <p className="admin-page-subtitle">Loading features…</p>
        ) : (
          <div className="features-grid">
            {features.map((f) => (
              <Link key={f.slug} href={`/features/${f.slug}`} className="feature-card-link">
                <Card
                  title={f.label}
                  description={f.description}
                  className={clsx('feature-card', f.enabled ? 'is-enabled' : 'is-disabled')}
                >
                  <div className="feature-card-footer">
                    <code className="mono">{f.slug}</code>
                    <span className={`badge ${f.enabled ? 'badge-ok' : 'badge-dead'}`}>
                      {f.enabled ? 'On' : 'Off'}
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
