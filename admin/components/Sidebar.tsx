import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  LayoutGrid,
  Server,
  Sliders,
  Key,
  Cloud,
  Settings,
  Code,
  Globe,
  RotateCw,
  LogOut,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

const monitor: NavItem[] = [{ label: 'Overview', href: '/', icon: LayoutGrid }];

const configure: NavItem[] = [
  { label: 'Providers & defaults', href: '/providers', icon: Server },
  { label: 'Quality & filters', href: '/quality', icon: Sliders },
  { label: 'API keys', href: '/keys', icon: Key },
  { label: 'FebBox', href: '/febbox', icon: Cloud },
];

const system: NavItem[] = [
  { label: 'Advanced', href: '/advanced', icon: Settings },
  { label: 'Live configuration', href: '/live', icon: Code },
  { label: 'IPTV Live TV', href: '/iptv', icon: Globe },
];

export function Sidebar() {
  const groups: Array<{ label: string; items: NavItem[] }> = [
    { label: 'Monitor', items: monitor },
    { label: 'Configure', items: configure },
    { label: 'System', items: system },
  ];

  return (
    <aside className="admin-sidebar" id="admin-sidebar" aria-label="Administration navigation">
      <div className="admin-sidebar-brand">
        <img
          src="/assets/peak-mark.svg"
          alt=""
          width={36}
          height={36}
          className="admin-sidebar-brand-img"
        />
        <span>peak</span>
        <span className="admin-sidebar-title">admin</span>
      </div>

      <nav className="admin-nav" aria-label="Primary">
        {groups.map(({ label, items }) => (
          <div className="admin-nav-group" key={label}>
            <p className="admin-nav-label">{label}</p>
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="admin-nav-item"
                aria-current={item.href === '/' ? 'page' : undefined}
              >
                <item.icon />
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <div className="admin-sidebar-footer">
        <div className="admin-sidebar-actions">
          <button type="button" className="admin-sidebar-action">
            <RotateCw />
            <span>Restart server</span>
          </button>
          <button type="button" className="admin-sidebar-action">
            <LogOut />
            <span>Sign out</span>
          </button>
        </div>
        <div style={{ padding: '12px 0', fontSize: '0.7rem', color: 'var(--color-fd-muted-foreground)' }}>
          <span>Peak</span> <span>v1.0.0</span>
        </div>
      </div>
    </aside>
  );
}
