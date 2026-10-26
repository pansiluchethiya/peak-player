'use client';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Shared layout shell for all authenticated admin pages.
 * Wraps the Sidebar + Header chrome and renders children in the content area.
 * Owns the mobile navigation drawer state so the topbar toggle and the
 * sidebar stay in sync.
 */
export function AdminShell({ title, children }: { title: string; children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer after navigating and when the viewport grows past the
  // breakpoint where the sidebar is permanent.
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNavOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navOpen]);

  return (
    <div className="admin-app" data-has-sidebar="true" data-nav-open={navOpen ? 'true' : 'false'}>
      <Sidebar open={navOpen} />
      <button
        type="button"
        className="admin-nav-backdrop"
        aria-label="Close navigation"
        tabIndex={navOpen ? 0 : -1}
        onClick={() => setNavOpen(false)}
      />
      <div className="admin-main">
        <Header title={title} navOpen={navOpen} onToggleNav={() => setNavOpen((v) => !v)} />
        <main className="admin-content" id="mainContent" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}

/**
 * Client-side auth guard. Checks /auth/session on mount; while checking shows
 * a neutral loading state. Once resolved, if not authenticated, redirects to
 * /login. This complements the server-side middleware for client-side
 * navigation.
 */
export function useAuthCheck() {
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');

  useEffect(() => {
    let cancelled = false;
    fetch('/auth/session', { headers: { Accept: 'application/json' } })
      .then(async (r) => {
        const data = await r.json().catch(() => ({ authenticated: false }));
        if (!cancelled) {
          setStatus(data.authenticated ? 'authenticated' : 'unauthenticated');
          if (!data.authenticated && typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('unauthenticated');
      });
    return () => { cancelled = true; };
  }, []);

  return status;
}
