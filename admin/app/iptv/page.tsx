'use client';
import { AdminShell, useAuthCheck } from '@/components/AdminShell';
import { Card } from 'fumadocs-ui/components/card';
import { buttonVariants } from 'fumadocs-ui/components/ui/button';
import { clsx } from 'clsx';
import { Plus, Trash2, RefreshCw, CheckCircle, XCircle, Globe, Wifi } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Playlist {
  id: number;
  name: string;
  url: string;
  enabled: boolean;
  channelCount: number;
  lastSyncAt: string | null;
}

interface Channel {
  id: number;
  name: string;
  group: string;
  logo?: string;
  enabled: boolean | number;
  status: string;
  httpStatus: number | null;
  latencyMs: number | null;
  checkedAt: string | null;
}

interface SeedStatus {
  enabled: boolean;
  categories: string;
  countries: string;
  lastSyncAt: string | null;
  channelCount: number;
}

interface IptvStatus {
  playlists: Playlist[];
  groups: string[];
  channels: Channel[];
}

const HEALTH_BADGE: Record<string, string> = {
  ok: 'badge-ok',
  dead: 'badge-dead',
  unknown: 'badge-unknown',
};

export default function IptpPage() {
  const auth = useAuthCheck();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [data, setData] = useState<IptvStatus | null>(null);
  const [seed, setSeed] = useState<SeedStatus | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setStatus('loading');
      setError('');
      const [playlistsRes, groupsRes, channelsRes, seedRes] = await Promise.all([
        fetch('/api/admin/iptv/playlists'),
        fetch('/api/admin/iptv/groups'),
        fetch('/api/admin/iptv/channels?limit=1000'),
        fetch('/api/admin/iptv/seed'),
      ]);
      const playlistsData = await playlistsRes.json();
      const groupsData = await groupsRes.json();
      const channelsData = await channelsRes.json();
      const seedData = await seedRes.json();
      if (!playlistsData.success) throw new Error(playlistsData.error || 'Failed to load playlists');
      if (!seedData.success) throw new Error(seedData.error || 'Failed to load seed status');
      setData({ playlists: playlistsData.playlists, groups: groupsData.groups, channels: channelsData.channels ?? [] });
      setSeed(seedData.seed);
      setStatus('ready');
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Failed to load IPTV data');
    }
  };

  useEffect(() => { load(); }, []);

  const toggleEnabled = async (id: number, enabled: boolean | number) => {
    try {
      const res = await fetch(`/api/admin/iptv/channels/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !enabled }),
      });
      const result = await res.json();
      if (result.success && data) {
        setData({ ...data, channels: data.channels.map(c => c.id === id ? { ...c, enabled: !enabled } : c) });
      }
    } catch {
      // ignore
    }
  };

  const togglePlaylistEnabled = async (id: number, enabled: boolean) => {
    try {
      await fetch(`/api/admin/iptv/playlists/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !enabled }),
      });
      if (data) {
        setData({ ...data, playlists: data.playlists.map(p => p.id === id ? { ...p, enabled: !enabled } : p) });
      }
    } catch {
      // ignore
    }
  };

  const deletePlaylist = async (id: number) => {
    if (!confirm('Remove this playlist?')) return;
    try {
      const res = await fetch(`/api/admin/iptv/playlists/${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success && data) {
        setData({ ...data, playlists: data.playlists.filter(p => p.id !== id) });
      }
    } catch {
      // ignore
    }
  };

  const syncPlaylist = async (id: number) => {
    try {
      setStatus('loading');
      const res = await fetch(`/api/admin/iptv/playlists/${id}/sync`, { method: 'POST' });
      const result = await res.json();
      if (result.success) {
        await load();
      } else {
        setError(result.error || 'Sync failed');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed');
    }
  };

  const syncSeed = async () => {
    try {
      setStatus('loading');
      const res = await fetch('/api/admin/iptv/seed/sync', { method: 'POST' });
      const result = await res.json();
      if (result.success) await load(); else setError(result.error || 'Seed failed');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Seed failed');
    }
  };

  const saveSeed = async () => {
    try {
      const res = await fetch('/api/admin/iptv/seed', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: seed?.enabled, categories: seed?.categories, countries: seed?.countries }),
      });
      const result = await res.json();
      if (result.success) setSeed(result.seed); else setError(result.error || 'Failed to save seed');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save seed');
    }
  };

  const addPlaylist = async () => {
    if (!newName || !newUrl) return;
    try {
      const res = await fetch('/api/admin/iptv/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, url: newUrl }),
      });
      const result = await res.json();
      if (result.success) {
        setShowAddForm(false);
        setNewName('');
        setNewUrl('');
        await load();
      } else {
        setError(result.error || 'Failed to add playlist');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add playlist');
    }
  };

  if (auth === 'loading') {
    return (
      <AdminShell title="IPTV">
        <p className="admin-page-subtitle">Checking session…</p>
      </AdminShell>
    );
  }

  const isChannelEnabled = (c: Channel) => (typeof c.enabled === 'number' ? c.enabled !== 0 : c.enabled !== false);

  return (
    <AdminShell title="IPTV Live TV">
      <div className="banner-stack" />
      <section className="page-status" aria-labelledby="title-iptv">
        <div className="page-head">
          <div>
            <p className="admin-eyebrow">System</p>
            <h1 id="title-iptv">IPTV Live TV</h1>
            <p className="admin-page-subtitle">
              Manage M3U/XTREAM playlist sources, seed from iptv-org, and browse synced channels with health.
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
            <XCircle /> <span>{error}</span>
          </div>
        )}

        <Card title="Seed from iptv-org" description="iptv-org catalogue" style={{ marginTop: 24 }}>
          <div style={{ marginBottom: 14 }}>
            <button type="button" className={clsx(buttonVariants({ variant: 'primary' }), 'btn-sm')} onClick={syncSeed}>
              <Wifi size={14} /> Sync seed now
            </button>
          </div>
          {seed ? (
            <table className="admin-table" style={{ fontSize: '0.8rem' }}>
              <thead>
                <tr><th>Setting</th><th>Value</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td>Enabled</td>
                  <td>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="checkbox"
                        checked={seed.enabled}
                        onChange={(e) => setSeed({ ...seed, enabled: e.target.checked })}
                      />
                      {seed.enabled ? 'On' : 'Off'}
                    </label>
                  </td>
                </tr>
                <tr>
                  <td>Categories</td>
                  <td>
                    <input
                      type="text"
                      value={seed.categories}
                      onChange={(e) => setSeed({ ...seed, categories: e.target.value })}
                      placeholder="comma/space separated, or *"
                    />
                  </td>
                </tr>
                <tr>
                  <td>Countries</td>
                  <td>
                    <input
                      type="text"
                      value={seed.countries}
                      onChange={(e) => setSeed({ ...seed, countries: e.target.value })}
                      placeholder="comma/space separated, or *"
                    />
                  </td>
                </tr>
                <tr><td>Channels seeded</td><td>{seed.channelCount ?? 0}</td></tr>
                <tr><td>Last synced</td><td>{seed.lastSyncAt ? new Date(seed.lastSyncAt).toLocaleString() : '—'}</td></tr>
                <tr><td colSpan={2}>
                  <button type="button" className={clsx(buttonVariants({ variant: 'secondary' }), 'btn-sm')} onClick={saveSeed}>
                    <CheckCircle size={14} /> Save seed settings
                  </button>
                </td></tr>
              </tbody>
            </table>
          ) : null}
        </Card>

        <Card title="Playlists" description="M3U / XTREAM playlist sources" style={{ marginTop: 24 }}>
          <div style={{ marginBottom: 14 }}>
            <button
              type="button"
              className={clsx(buttonVariants({ variant: 'secondary' }), 'btn-sm')}
              onClick={() => setShowAddForm(!showAddForm)}
            >
              <Plus size={16} /> {showAddForm ? 'Cancel' : 'Add playlist'}
            </button>
          </div>

          {showAddForm && (
            <div className="pw-change" style={{ marginBottom: 16 }}>
              <div className="field">
                <label htmlFor="playlistName">Name</label>
                <input
                  id="playlistName"
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Live TV EPG"
                />
              </div>
              <div className="field">
                <label htmlFor="playlistUrl">URL</label>
                <input
                  id="playlistUrl"
                  type="url"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://example.com/playlist.m3u"
                />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button type="button" className={clsx(buttonVariants(), 'btn-sm')} onClick={addPlaylist}>
                  Add
                </button>
                <button
                  type="button"
                  className={clsx(buttonVariants({ variant: 'secondary' }), 'btn-sm')}
                  onClick={() => setShowAddForm(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Channels</th>
                <th>Last synced</th>
                <th>Status</th>
                <th align="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(!data || data.playlists.length === 0) ? (
                <tr>
                  <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-fd-muted-foreground)' }}>
                    No playlists configured. Add one above.
                  </td>
                </tr>
              ) : (
                data.playlists.map((p) => (
                  <tr key={p.id}>
                    <td><strong>{p.name}</strong></td>
                    <td>{p.channelCount ?? 0}</td>
                    <td style={{ color: 'var(--color-fd-muted-foreground)', fontSize: '0.8rem' }}>
                      {p.lastSyncAt ? new Date(p.lastSyncAt).toLocaleString() : '—'}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => togglePlaylistEnabled(p.id, p.enabled)}
                      >
                        {p.enabled ? (
                          <span className="status-on" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle size={14} /> Enabled
                          </span>
                        ) : (
                          <span className="status-off" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <XCircle size={14} /> Disabled
                          </span>
                        )}
                      </button>
                    </td>
                    <td align="right" style={{ whiteSpace: 'nowrap' }}>
                      <button type="button" className="icon-btn" onClick={() => syncPlaylist(p.id)} title="Sync now">
                        <RefreshCw size={14} />
                      </button>
                      <button type="button" className="icon-btn" onClick={() => deletePlaylist(p.id)} title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>

        <Card title="Channels" description="Synced channels and playback health" style={{ marginTop: 24 }}>
          <div style={{ maxHeight: 500, overflow: 'auto' }}>
            <table className="admin-table" style={{ fontSize: '0.8rem' }}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Group</th>
                  <th>Health</th>
                  <th>Latency</th>
                  <th>Last checked</th>
                  <th align="right">Enabled</th>
                </tr>
              </thead>
              <tbody>
                {(!data || data.channels.length === 0) ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-fd-muted-foreground)' }}>
                      No channels yet. Seed or sync a playlist to populate.
                    </td>
                  </tr>
                ) : (
                  data.channels.map((c) => (
                    <tr key={c.id}>
                      <td><strong>{c.name}</strong></td>
                      <td style={{ color: 'var(--color-fd-muted-foreground)' }}>{c.group ?? '—'}</td>
                      <td>
                        <span className={HEALTH_BADGE[c.status] ?? 'badge-unknown'}>
                          {c.status}
                        </span>
                        {c.httpStatus ? ` (${c.httpStatus})` : null}
                      </td>
                      <td>{c.latencyMs != null ? `${c.latencyMs} ms` : '—'}</td>
                      <td style={{ color: 'var(--color-fd-muted-foreground)', fontSize: '0.8rem' }}>
                        {c.checkedAt ? new Date(c.checkedAt).toLocaleString() : '—'}
                      </td>
                      <td align="right">
                        <button
                          type="button"
                          className="link-btn"
                          onClick={() => toggleEnabled(c.id, c.enabled)}
                        >
                          {isChannelEnabled(c) ? (
                            <span className="status-on" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <CheckCircle size={14} /> {c.name ? '' : ''}On
                            </span>
                          ) : (
                            <span className="status-off" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <XCircle size={14} /> Off
                            </span>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </AdminShell>
  );
}
