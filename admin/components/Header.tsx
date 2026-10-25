import { ThemeToggle } from '@/components/ThemeToggle';
import { Menu } from 'lucide-react';
import type { ReactNode } from 'react';

export function Header({ title = 'Overview' }: { title?: string; actions?: ReactNode }) {
  return (
    <header className="admin-topbar">
      <button
        type="button"
        className="icon-btn"
        aria-label="Open navigation"
        aria-controls="admin-sidebar"
        aria-expanded
      >
        <Menu />
      </button>
      <div className="admin-topbar-title">
        <span className="admin-topbar-eyebrow">Peak admin</span>
        <strong className="admin-topbar-page">{title}</strong>
      </div>
      <div className="admin-topbar-actions">
        <span className="admin-health-chip" role="status" aria-live="polite">
          <span className="health-dot" aria-hidden="true" />
          <span>Checking API</span>
        </span>
        <ThemeToggle />
      </div>
    </header>
  );
}
