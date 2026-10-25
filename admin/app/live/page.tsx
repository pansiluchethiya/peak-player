'use client';
import { AdminShell, useAuthCheck } from '@/components/AdminShell';
import { Card } from 'fumadocs-ui/components/card';
import { buttonVariants } from 'fumadocs-ui/components/ui/button';
import { clsx } from 'clsx';
import { Tv, RefreshCw, AlertCircle, Globe, List } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Channel {
  id: number;
  name: string;
  groupTitle: string;
  logo?: string;
  language?: string;
  country?: string;
}

interface LiveStatus {
  channels: Channel[];
  groups: string[];
  nextCursor?: string;
}

export default function LivePage() {
  const auth = useAuthCheck();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [data, setData] = useState<LiveStatus | null>(null);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const load = async (group?: string, q?: string) => {
    try {
      setStatus('loading');
      setError('');
      const params = new URLSearchParams();
      if (group) params.set('group', group);
      if (q) params.set('q', q);
      params.set('limit', '200');

      const [channelsRes, groupsRes] = await Promise.all([
        fetch(`/api/v1/live/tv/channels?${params.toString()}`),
        fetch('/api/v1/live/tv/groups'),
      ]);
      const channelsData = await channelsRes.json();
      const groupsData = await groupsRes.json();
      if (!channelsData.success) throw new Error(channelsData.error || 'Failed to load channels');
      setData({ channels: channelsData.channels, groups: groupsData.groups });
      setStatus('ready');
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Failed to load live TV data');
    }
  };

  useEffect(() => { load(); }, []);

  if (auth === 'loading') return <AdminShell title="Live config"><p className="admin-page-subtitle">Checking session…</p></AdminShell>;

  const channels = data?.channels ?? [];
  const filtered = activeGroup
    ? channels.filter((c) => c.groupTitle === activeGroup)
    : channels;

  return (
    <AdminShell title="Live configuration">
      <div className="banner-stack" />
      <section className="page-status" aria-labelledby="title-live">
        <div className="page-head">
          <div>
            <p className="admin-eyebrow">System</p>
            <h1 id="title-live">IPTV Live TV channels</h1>
            <p className="admin-page-subtitle">
              Browse synced IPTV channels. Channel IDs are usable in the embed player
              (<code>/embed/live/{'{id'}</code>).
            </p>
          </div>
          <button type="button" className={clsx(buttonVariants({ variant: 'secondary' }), 'btn-sm')} onClick={() => load()} disabled={status === 'loading'}>
            <RefreshCw className={status === 'loading' ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {error && <div className="alert danger" role="alert" style={{ marginTop: 16 }}><AlertCircle /> <span>{error}</span></div>}

        <Card title="Groups" description="Channel categories" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button
              type="button"
              className={clsx(buttonVariants({ variant: activeGroup ? 'secondary' : 'default' }), 'btn-sm')}
              onClick={() => setActiveGroup(null)}
            >
              <List size={14} /> All
            </button>
            {data?.groups.map((g) => (
              <button
                key={g}
                type="button"
                className={clsx(buttonVariants({ variant: activeGroup === g ? 'default' : 'secondary' }), 'btn-sm')}
                onClick={() => setActiveGroup(g)}
              >
                {g}
              </button>
            ))}
          </div>
        </Card>

        <Card title="Channels" description={activeGroup ? `Group: ${activeGroup}` : 'All channels'}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label htmlFor="search">Search channels</label>
            <input
              id="search"
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); }}
              placeholder="Filter by name…"
            />
          </div>

          {status === 'loading' ? (
            <p style={{ padding: '12px 0', color: 'var(--color-fd-muted-foreground)' }}>Loading channels…</p>
          ) : filtered.length === 0 ? (
            <p style={{ padding: '12px 0', color: 'var(--color-fd-muted-foreground)' }}>No channels found.</p>
          ) : (
            <div style={{ maxHeight: 500, overflow: 'auto' }}>
              <table className="admin-table" style={{ fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Group</th>
                    <th>Language</th>
                    <th>Country</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered
                    .filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()))
                    .map((c) => (
                      <tr key={c.id}>
                        <td>
                          <strong>{c.name}</strong>
                        </td>
                        <td style={{ color: 'var(--color-fd-muted-foreground)' }}>{c.groupTitle}</td>
                        <td>{c.language ?? '—'}</td>
                        <td>{c.country ?? '—'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>
    </AdminShell>
  );
}
