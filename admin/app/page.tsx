import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { Card } from 'fumadocs-ui/components/card';
import { buttonVariants } from 'fumadocs-ui/components/ui/button';
import { TypeTable } from 'fumadocs-ui/components/type-table';
import { clsx } from 'clsx';
import type { ComponentType } from 'react';
import {
  Activity,
  Clock,
  Database,
  Server,
  Copy,
  Download,
  RefreshCw,
  Play,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';

interface Kpi {
  label: string;
  value: string;
  note: string;
  icon: ComponentType<{ className?: string }>;
}

const kpis: Kpi[] = [
  { label: 'Uptime', value: '—', note: 'Since last restart', icon: Clock },
  { label: 'Requests', value: '—', note: 'Total handled', icon: Activity },
  { label: 'Streams returned', value: '—', note: 'Across all requests', icon: Server },
  { label: 'Memory', value: '—', note: 'Node process RSS', icon: Database },
];

const endpoints = {
  'GET /api/status': { type: '200 · application/json', description: 'Health snapshot & uptime.' },
  'GET /api/health': { type: '200 · application/json', description: 'Lightweight health check.' },
  'GET /api/metrics': { type: '200 · application/json', description: 'Rolling runtime metrics.' },
  'GET /api/v1/stream/:type/:id': { type: '200 · HLS m3u8', description: 'Validated stream URL.' },
};

export default function DashboardPage() {
  return (
    <div className="admin-app" data-has-sidebar="true">
      <Sidebar />
      <div className="admin-main">
        <Header title="Overview" />
        <main className="admin-content" id="mainContent" tabIndex={-1}>
          <div className="banner-stack"></div>

          <section className="page-status" aria-labelledby="title-status">
            <div className="page-head">
              <div>
                <p className="admin-eyebrow">Monitor</p>
                <h1 id="title-status">Overview</h1>
                <p className="admin-page-subtitle">
                  A live read on your API, providers, and launch readiness.
                </p>
              </div>
              <div className="page-head-actions">
                <span className="admin-kpi-card" style={{ padding: '10px 14px' }}>
                  <span className="admin-kpi-value" style={{ fontSize: '1.1rem' }}>—</span>
                  <span className="admin-kpi-note">Checking</span>
                </span>
                <button type="button" className={clsx(buttonVariants({ variant: 'secondary' }), 'btn-sm')} id="refreshStatusBtn">
                  <RefreshCw /> Refresh
                </button>
              </div>
            </div>

            {/* KPI grid */}
            <div className="admin-kpi-grid" aria-label="Key metrics">
              {kpis.map((k) => (
                <article key={k.label} className="admin-kpi-card">
                  <div className="admin-kpi-label">
                    <span className="admin-kpi-icon"><k.icon className="icon" /></span>
                    <span>{k.label}</span>
                  </div>
                  <p className="admin-kpi-value" id={`kpi${k.label.replace(/\s/g, '')}`}>{k.value}</p>
                  <p className="admin-kpi-note">{k.note}</p>
                </article>
              ))}
            </div>

            <div className="admin-dashboard-grid">
              <div className="admin-dashboard-primary">
                {/* Provider health (fumadocs Card) */}
                <Card
                  title="Provider health"
                  description="Enablement, credentials, and live functional checks."
                  className="provider-card"
                >
                  <div className="provider-check-bar">
                    <label>
                      Check title <span className="mono">TMDB ID</span>
                    </label>
                    <div className="inline-field">
                      <input type="text" inputMode="numeric" defaultValue="278" placeholder="278" />
                      <button type="button" className={clsx(buttonVariants({ variant: 'secondary' }), 'btn-sm')}>
                        Save
                      </button>
                    </div>
                    <span className="provider-check-hint">
                      Default <span className="mono">278</span>. The provider matrix loads below.
                    </span>
                  </div>
                  <div className="provider-table">Provider status will load here.</div>
                </Card>

                {/* Endpoints (fumadocs TypeTable) */}
                <Card
                  title="Endpoints"
                  description="Copy a route to test it from your terminal."
                  className="endpoints-card"
                >
                  <TypeTable type={endpoints} />
                </Card>
              </div>

              <aside className="admin-gridrail" aria-label="Readiness and quick actions">
                {/* Readiness */}
                <Card title="Readiness" description="Launch check">
                  <div className="readiness-list">No readiness checks run yet.</div>
                  <p className="readiness-footnote">Checking your configuration…</p>
                </Card>

                {/* Quick actions */}
                <Card title="Quick actions" description="Shortcuts">
                  <div className="quick-actions">
                    <button type="button" className="quick-action">
                      <span className="quick-icon">{<RefreshCw />}</span>
                      <span><strong>Refresh status</strong><small>Pull the latest metrics</small></span>
                    </button>
                    <button type="button" className="quick-action">
                      <span className="quick-icon">{<Play />}</span>
                      <span><strong>Run provider checks</strong><small>Test all enabled sources</small></span>
                    </button>
                    <button type="button" className="quick-action">
                      <span className="quick-icon">{<ExternalLink />}</span>
                      <span><strong>Open player</strong><small>Embed preview on :3001</small></span>
                    </button>
                  </div>
                </Card>

                {/* Activity */}
                <Card title="Activity" description="Runtime">
                  <dl className="activity-list">
                    <div><dt>Last request</dt><dd>—</dd></div>
                    <div><dt>Stream requests</dt><dd>—</dd></div>
                    <div><dt>Provider calls</dt><dd>—</dd></div>
                    <div><dt>TMDB ↔ IMDb</dt><dd>—</dd></div>
                    <div><dt>Node runtime</dt><dd>—</dd></div>
                  </dl>
                  <p className="activity-refresh">Last refreshed —</p>
                </Card>
              </aside>
            </div>
          </section>

          <footer className="admin-footer">
            <ShieldCheck />
            <span>HMAC-SHA256 sessions · Local by design</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
