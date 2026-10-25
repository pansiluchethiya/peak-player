'use client';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { useEffect, useState } from 'react';

/**
 * Shared layout shell for all authenticated admin pages.
 * Wraps the Sidebar + Header chrome and renders children in the content area.
 */
export function AdminShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="admin-app" data-has-sidebar="true">
      <Sidebar />
      <div className="admin-main">
        <Header title={title} />
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
