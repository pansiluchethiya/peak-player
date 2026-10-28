'use client';
import { useEffect, useState } from 'react';
import { usePlayerContext } from '../PlayerProvider';
import { t } from '../i18n';

/** Always `H:MM:SS`, the timecode format viewers expect from a video player. */
export function formatTimecode(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00:00';
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/** Elapsed time on the left of the scrubber; click to flip to time remaining. */
export function TimeDisplay() {
  const { api } = usePlayerContext();
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [remaining, setRemaining] = useState(false);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const state = api.getState();
      setCurrent(state.currentTime);
      setDuration(state.duration);
      frame = window.requestAnimationFrame(tick);
    };
    tick();
    return () => window.cancelAnimationFrame(frame);
  }, [api]);

  const left = remaining ? Math.max(duration - current, 0) : current;
  return (
    <button
      type="button"
      className="peak-time-display peak-time-toggle"
      aria-live="polite"
      aria-label={remaining ? t('show-elapsed') : t('show-remaining')}
      title={remaining ? t('show-elapsed') : t('show-remaining')}
      onClick={() => setRemaining((value) => !value)}
    >
      {remaining ? `-${formatTimecode(left)}` : formatTimecode(left)}
    </button>
  );
}

/** Total runtime on the right of the scrubber. */
export function TotalTime() {
  const { api } = usePlayerContext();
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      setDuration(api.getState().duration);
      frame = window.requestAnimationFrame(tick);
    };
    tick();
    return () => window.cancelAnimationFrame(frame);
  }, [api]);

  return (
    <span className="peak-time-display peak-time-total" aria-label={t('total-time')}>
      {formatTimecode(duration)}
    </span>
  );
}
