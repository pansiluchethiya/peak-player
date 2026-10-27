'use client';
import { useEffect, useState } from 'react';
import { usePlayerContext } from '../PlayerProvider';
import { t } from '../i18n';
import { ControlButton } from './ControlButton';

interface SeekButtonProps {
  delta: number;
  label: string;
  icon: string;
}

export function SeekButton({ delta, label, icon }: SeekButtonProps) {
  const { api } = usePlayerContext();
  return (
    <ControlButton aria-label={label} icon={icon} onClick={() => api.seekBy(delta).catch(() => undefined)} />
  );
}

export function TimeDisplay() {
  const { api } = usePlayerContext();
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const s = api.getState();
      setCurrent(s.currentTime);
      setDuration(s.duration);
      frame = window.requestAnimationFrame(tick);
    };
    tick();
    return () => window.cancelAnimationFrame(frame);
  }, [api]);
  void t;
  return (
    <div className="peak-time-display" aria-live="polite">
      {formatTime(current)} / {formatTime(duration)}
    </div>
  );
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
