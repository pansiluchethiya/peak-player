'use client';
import { useEffect, useState } from 'react';
import { isBehindLive, liveLatency } from '../../../lib/live';
import { usePlayerContext } from '../PlayerProvider';
import { t } from '../i18n';

/** LIVE badge, latency chip, and a Go live action. Reads engine state for latency. */
export function LiveButton() {
  const { api } = usePlayerContext();
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const state = api.getState();
      setLatency(liveLatency(state.currentTime, state.liveEdgeStart));
      frame = window.requestAnimationFrame(tick);
    };
    tick();
    return () => window.cancelAnimationFrame(frame);
  }, [api]);

  const label = latency != null && latency > 0 ? `${Math.round(latency)}s behind` : t('live');
  const behind = latency != null && latency > 0 && isBehindLive(latency, 0);

  return (
    <button
      type="button"
      className="peak-live-button"
      aria-label={behind ? t('go-live') : label}
      onClick={() => api.goToLive().catch(() => undefined)}
      title={behind ? t('behind-live') : undefined}
    >
      <span className="peak-live-dot" aria-hidden="true" />
      <span className="peak-live-latency">{label}</span>
    </button>
  );
}
