'use client';
import { AdminShell, useAuthCheck } from '@/components/AdminShell';
import { Card } from 'fumadocs-ui/components/card';
import { buttonVariants } from 'fumadocs-ui/components/ui/button';
import { clsx } from 'clsx';
import { ToggleRight, ToggleLeft, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FEATURE_DEFS } from '@/components/FeatureToggle';

export default function FeatureDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const auth = useAuthCheck();
  const router = useRouter();
  const [slug, setSlug] = useState<string>('');
  const [feature, setFeature] = useState<{
    slug: string;
    key: string;
    label: string;
    description: string;
    enabled: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void params.then((p) => setSlug(p.slug));
  }, [params]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/features', {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      const data = (await res.json()) as { success?: boolean; features?: Array<{ slug: string; key: string; label: string; description: string; enabled: boolean }> };
      const found = data?.features?.find((f) => f.slug === slug);
      if (!found) {
        setError(`Feature "${slug}" not found`);
      } else {
        setFeature(found);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load feature');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [slug]);

  async function toggle(enabled: boolean) {
    if (!feature) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [feature.key]: enabled }),
      });
      const data = await res.json();
      if (data.success) {
        setFeature({ ...feature, enabled });
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  if (auth === 'loading' || loading) {
    return (
      <AdminShell title={slug}>
        <p className="admin-page-subtitle">Checking session…</p>
      </AdminShell>
    );
  }

  if (error || !feature) {
    return (
      <AdminShell title={slug}>
        <p className="admin-banner admin-banner-danger" role="alert">{error || 'Feature not found'}</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell title={feature.label}>
      <div className="admin-features">
        <div className="page-head">
          <div>
            <p className="admin-eyebrow">Features</p>
            <h1>{feature.label}</h1>
            <p className="admin-page-subtitle">{feature.description}</p>
          </div>
          <button
            type="button"
            className={clsx(buttonVariants({ variant: 'secondary' }), 'btn-sm')}
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        <Card title={feature.label} description="Feature status">
          <div className="feature-detail">
            <div className="feature-detail-row">
              <span>Slug</span>
              <code className="mono">{feature.slug}</code>
            </div>
            <div className="feature-detail-row">
              <span>Config key</span>
              <code className="mono">{feature.key}</code>
            </div>
            <div className="feature-detail-row">
              <span>Status</span>
              <span className={`badge ${feature.enabled ? 'badge-ok' : 'badge-dead'}`}>
                {feature.enabled ? (
                  <> <CheckCircle className="icon-sm" /> Enabled </>
                ) : (
                  <> <XCircle className="icon-sm" /> Disabled </>
                )}
              </span>
            </div>
            <div className="feature-detail-row">
              <span>Action</span>
              <div className="feature-toggle-switch">
                <button
                  type="button"
                  className={clsx(
                    buttonVariants({ variant: feature.enabled ? 'primary' : 'secondary' }),
                    'btn-sm',
                  )}
                  onClick={() => void toggle(false)}
                  disabled={saving}
                >
                  <ToggleLeft /> Disable
                </button>
                <button
                  type="button"
                  className={clsx(
                    buttonVariants({ variant: feature.enabled ? 'primary' : 'secondary' }),
                    'btn-sm',
                  )}
                  onClick={() => void toggle(true)}
                  disabled={saving}
                >
                  <ToggleRight /> Enable
                </button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}
