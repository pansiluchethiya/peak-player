'use client';
import { AdminShell, useAuthCheck } from '@/components/AdminShell';
import { Card } from 'fumadocs-ui/components/card';
import { buttonVariants } from 'fumadocs-ui/components/ui/button';
import { clsx } from 'clsx';
import { Plus, Trash2, RefreshCw, CheckCircle, XCircle, Globe } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Playlist {
  id: number;
  name: string;
  url: string;
  enabled: boolean;
  channelCount: number;
  lastSynced: string | null;
}

interface IptvStatus {
  playlists: Playlist[];
  groups: string[];
}

export default function IptpPage() {
  const auth = useAuthCheck();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [data, setData] = useState<IptvStatus | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setStatus('loading');
      setError('');
      const [playlistsRes, groupsRes] = await Promise.all([
        fetch('/api/admin/iptv/playlists'),
        fetch('/api/admin/iptv/groups'),
      ]);
      const playlistsData = await playlistsRes.json();
      const groupsData = await groupsRes.json();
      if (!playlistsData.success) throw new Error(playlistsData.error || 'Failed to load playlists');
      setData({ playlists: playlistsData.playlists, groups: groupsData.groups });
      setStatus('ready');
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Failed to load IPTV data');
    }
  };

  useEffect(() => { load(); }, []);

  const toggleEnabled = async (id: number, enabled: boolean) => {
    try {
      const res = await fetch(`/api/admin/iptv/playlists/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !enabled }),
      });
      const result = await res.json();
      if (result.success && data) {
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

  return (
    <AdminShell title="IPTV Live TV">
      <div className="banner-stack" />
      <section className="page-status" aria-labelledby="title-iptv">
        <div className="page-head">
          <div>
            <p className="admin-eyebrow">System</p>
            <h1 id="title-iptv">IPTV Live TV</h1>
            <p className="admin-page-subtitle">
              Manage M3U/XTREAM playlist sources and browse synced channels.
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

        <Card title="Playlists" description="M3U / XTREAM playlist sources">
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
                      {p.lastSynced ? new Date(p.lastSynced).toLocaleString() : '—'}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => toggleEnabled(p.id, p.enabled)}
                      >
                        {p.enabled ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--color-success)' }}>
                            <CheckCircle size={14} /> Enabled
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--color-error)' }}>
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

        <Card title="Groups" description="IPTV channel categories" style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {(!data || data.groups.length === 0) ? (
              <p style={{ color: 'var(--color-fd-muted-foreground)', fontSize: '0.85rem' }}>No groups available.</p>
            ) : (
              data.groups.map((g) => (
                <span key={g} className="admin-kpi-note" style={{ padding: '6px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--color-fd-accent)', fontSize: '0.75rem' }}>
                  <Globe size={12} style={{ marginRight: 4 }} /> {g}
                </span>
              ))
            )}
          </div>
        </Card>
      </section>
    </AdminShell>
  );
}
