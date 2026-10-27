'use client';
import { usePlayerContext } from '../PlayerProvider';
import { t } from '../i18n';

interface VolumeControlProps {
  boost?: number;
}

/** Mute toggle, volume slider, and a boost unlock with amber state above 300%. */
export function VolumeControl({ boost = 1 }: VolumeControlProps) {
  const { api, preferences } = usePlayerContext();
  return (
    <div className="peak-volume-control">
      <button type="button" aria-label={preferences.muted ? t('unmute') : t('mute')} onClick={() => api.setMuted(!preferences.muted).catch(() => undefined)}>
        {preferences.muted ? 'Mute' : 'Unmute'}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        aria-label={t('volume')}
        value={preferences.volume}
        onChange={(e) => api.setVolume(Number(e.target.value)).catch(() => undefined)}
      />
      <span className={boost > 3 ? 'peak-volume-boost-amber' : undefined}>{Math.round(boost * 100)}%</span>
    </div>
  );
}
