'use client';

import { useEffect, useState } from 'react';

type HealthState = 'checking' | 'online' | 'degraded' | 'offline';

const LABELS: Record<HealthState, string> = {
  checking: 'Checking API',
  online: 'API online',
  degraded: 'API degraded',
  offline: 'API offline',
};

/**
 * Polls the API health endpoint and reflects the result in the topbar.
 * Renders a coloured dot plus a short label; the full detail is in the title.
 */
export function HealthChip() {
  const [state, setState] = useState<HealthState>('checking');
  const [detail, setDetail] = useState('Checking API health…');

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function check() {
      try {
        const res = await fetch('/api/health', {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { ok?: boolean; service?: string };
        if (cancelled) return;
        if (data?.ok) {
          setState('online');
          setDetail(`${data.service ?? 'API'} responded OK`);
        } else {
          setState('degraded');
          setDetail('API responded without ok:true');
        }
      } catch (error) {
        if (cancelled) return;
        setState('offline');
        setDetail(`API unreachable: ${(error as Error).message}`);
      } finally {
        if (!cancelled) timer = setTimeout(check, 20000);
      }
    }

    check();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return (
    <span
      className="admin-health-chip"
      data-state={state}
      role="status"
      aria-live="polite"
      title={detail}
    >
      <span className="health-dot" aria-hidden="true" />
      <span>{LABELS[state]}</span>
    </span>
  );
}
