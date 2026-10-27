'use client';
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { usePlayerContext } from '../PlayerProvider';

/**
 * Live-aware scrubber. Renders a DVR range when the live edge + target window
 * are known, otherwise a non-seekable live rail. On-demand fallback keeps the
 * basic seek behaviour intact.
 */
export function Scrubber() {
  const { api } = usePlayerContext();
  const [state, setState] = useState(() => api.getState());
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      setState(api.getState());
      frame = window.requestAnimationFrame(tick);
    };
    tick();
    return () => window.cancelAnimationFrame(frame);
  }, [api]);

  const live = state.live;
  const hasDvr = live && Number.isFinite(state.liveEdgeStart) && Number.isFinite(state.targetLiveWindow);
  const max = hasDvr ? state.liveEdgeStart : state.duration;
  const min = hasDvr ? state.liveEdgeStart - state.targetLiveWindow : 0;
  const value = Math.min(Math.max(state.currentTime, min >= 0 ? min : 0), max || 1);

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = Number(e.target.value);
    if (Number.isFinite(next)) api.seek(next).catch(() => undefined);
  };

  return (
    <div className="peak-scrubber" ref={trackRef}>
      {hasDvr ? <span className="peak-live-range" /> : live ? <span className="peak-live-static" /> : null}
      <input
        type="range"
        min={min >= 0 ? min : 0}
        max={max || 1}
        value={value}
        aria-label={live ? 'Live position' : 'Seek'}
        onChange={onChange}
        readOnly={live && !hasDvr}
      />
    </div>
  );
}
