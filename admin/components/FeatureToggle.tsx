'use client';

import { useEffect, useState } from 'react';
import { Card } from 'fumadocs-ui/components/card';
import { buttonVariants } from 'fumadocs-ui/components/ui/button';
import { clsx } from 'clsx';
import { RefreshCw, ToggleLeft, ToggleRight, CheckCircle, XCircle } from 'lucide-react';

export interface FeatureDef {
  slug: string;
  key: string;
  label: string;
  description: string;
}

export interface FeatureState {
  slug: string;
  key: string;
  label: string;
  description: string;
  enabled: boolean;
}

/** Feature definitions (spec §5). Hardcoded so the client bundle does not pull
 *  server-side Node modules. The server also exports the same list. */
export const FEATURE_DEFS: FeatureDef[] = [
  { slug: 'embed-demo', key: 'embed_demo', label: 'Embed Demo', description: 'Enables the /embed/demo page that mints demo sessions.' },
  { slug: 'token-auth', key: 'token_auth', label: 'Token Auth', description: 'Enables HMAC-SHA256 embed token verification on the player side.' },
  { slug: 'dubs', key: 'dubs', label: 'Dubs', description: 'Enables the DubsMenu for language-specific renditions.' },
  { slug: 'captions', key: 'captions', label: 'Captions', description: 'Enables subtitle track loading and rendering.' },
  { slug: 'color-filters', key: 'color_filters', label: 'Color Filters', description: 'Enables the CSS filter pipeline and WebGL colour pipeline.' },
  { slug: 'scrubber-thumbnails', key: 'scrubber_thumbnails', label: 'Scrubber Thumbnails', description: 'Enables remote VTT sprite previews on hover.' },
  { slug: 'audio-boost', key: 'audio_boost', label: 'Audio Boost', description: 'Enables the VolumeBoost gain node (up to 200%).' },
  { slug: 'keyboard-shortcuts', key: 'keyboard_shortcuts', label: 'Keyboard Shortcuts', description: 'Enables keyboard navigation and hotkeys.' },
  { slug: 'stats-overlay', key: 'stats_overlay', label: 'Stats Overlay', description: 'Enables the StatsOverlay component (bitrate, latency).' },
  { slug: 'chapters', key: 'chapters', label: 'Chapters', description: 'Enables chapter markers and the ChaptersMenu.' },
  { slug: 'quality-selection', key: 'quality_selection', label: 'Quality Selection', description: 'Enables the QualityMenu for manual ABR cap selection.' },
  { slug: 'playback-speed', key: 'playback_speed', label: 'Playback Speed', description: 'Enables the SpeedMenu (0.25x–2x).' },
  { slug: 'pip', key: 'pip', label: 'PiP', description: 'Enables Picture-in-Picture mode.' },
  { slug: 'mux-analytics', key: 'mux_analytics', label: 'Mux Analytics', description: 'Enables Mux data analytics tracking.' },
  { slug: 'server-switching', key: 'server_switching', label: 'Server Switching', description: 'Enables the ServerMenu for manual provider switching.' },
];

export function FeatureToggle() {
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  async function updateFeature(key: string, enabled: boolean) {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: enabled }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'update failed');
      setFeatures((prev) =>
        prev.map((f) => (f.key === key ? { ...f, enabled } : f)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update feature');
    } finally {
      setSaving(false);
    }
  }

  const enabledCount = features.filter((f) => f.enabled).length;

  return (
    <div className="admin-features">
      <div className="page-head">
        <div>
          <p className="admin-eyebrow">Features</p>
          <h1>Feature toggles</h1>
          <p className="admin-page-subtitle">
            {loading ? 'Loading…' : `${enabledCount} of ${features.length} features enabled`}
          </p>
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

      {error && <div className="admin-banner admin-banner-danger" role="alert">{error}</div>}

      <Card title="All features" description="15 player features controllable from this panel">
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">Feature</th>
              <th scope="col">Slug</th>
              <th scope="col">Status</th>
              <th scope="col" className="text-right">Toggle</th>
            </tr>
          </thead>
          <tbody>
            {features.map((f) => (
              <tr key={f.slug}>
                <td>
                  <strong>{f.label}</strong>
                  <small className="admin-muted">{f.description}</small>
                </td>
                <td className="mono">{f.slug}</td>
                <td>
                  {f.enabled ? (
                    <span className="badge badge-ok"><CheckCircle className="icon-sm" /> On</span>
                  ) : (
                    <span className="badge badge-dead"><XCircle className="icon-sm" /> Off</span>
                  )}
                </td>
                <td className="text-right">
                  <button
                    type="button"
                    className={clsx(
                      buttonVariants({ variant: 'secondary' }),
                      'btn-sm',
                      'btn-icon',
                    )}
                    onClick={() => void updateFeature(f.key, !f.enabled)}
                    disabled={saving}
                    aria-label={f.enabled ? 'Disable' : 'Enable'}
                  >
                    {f.enabled ? <ToggleRight className="text-fd-success" /> : <ToggleLeft />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
