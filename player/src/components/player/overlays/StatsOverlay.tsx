'use client';
import { useEffect, useState } from 'react';
import { usePlayerContext } from '../PlayerProvider';
import { t } from '../i18n';

interface Props { onClose: () => void }

/** Real-time player stats overlay (spec §6.3). */
export function StatsOverlay({ onClose }: Props) {
  const { api } = usePlayerContext();
  const [state, setState] = useState(api.getState());

  useEffect(() => {
    let frame = 0;
    const tick = () => { setState(api.getState()); frame = requestAnimationFrame(tick); };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [api]);

  return (
    <div className="peak-stats-overlay" role="dialog" aria-modal="true">
      <div className="peak-stats-content">
        <h3>{t('stats')}</h3>
        <table>
          <tbody>
            <tr><td>State</td><td>{state.playing ? 'playing' : 'paused'}</td></tr>
            <tr><td>Time</td><td>{state.currentTime.toFixed(2)}s / {state.duration.toFixed(2)}s</td></tr>
            <tr><td>Volume</td><td>{Math.round(state.volume * 100)}%</td></tr>
            <tr><td>Muted</td><td>{state.muted ? 'yes' : 'no'}</td></tr>
            <tr><td>Speed</td><td>{state.speed.toFixed(2)}x</td></tr>
            <tr><td>Captions</td><td>{state.captionsEnabled ? 'on' : 'off'}</td></tr>
            <tr><td>Fullscreen</td><td>{state.fullscreen ? 'yes' : 'no'}</td></tr>
          </tbody>
        </table>
        <button type="button" onClick={onClose}>{t('close')}</button>
      </div>
    </div>
  );
}
