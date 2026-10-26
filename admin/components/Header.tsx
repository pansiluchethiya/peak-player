'use client';

import { ThemeToggle } from '@/components/ThemeToggle';
import { HealthChip } from '@/components/HealthChip';
import { Menu } from 'lucide-react';
import type { ReactNode } from 'react';

export function Header({
  title = 'Overview',
  actions,
  navOpen = false,
  onToggleNav,
}: {
  title?: string;
  actions?: ReactNode;
  navOpen?: boolean;
  onToggleNav?: () => void;
}) {
  return (
    <header className="admin-topbar">
      <button
        type="button"
        className="icon-btn admin-nav-toggle"
        aria-label={navOpen ? 'Close navigation' : 'Open navigation'}
        aria-controls="admin-sidebar"
        aria-expanded={navOpen}
        onClick={onToggleNav}
      >
        <Menu />
      </button>
      <div className="admin-topbar-title">
        <span className="admin-topbar-eyebrow">Peak admin</span>
        <strong className="admin-topbar-page">{title}</strong>
      </div>
      <div className="admin-topbar-actions">
        {actions}
        <HealthChip />
        <ThemeToggle />
      </div>
    </header>
  );
}
