'use client';
import { Volume1, Volume2, VolumeX } from 'lucide-react';
import { usePlayerContext } from '../PlayerProvider';
import { t } from '../i18n';

interface VolumeControlProps {
  boost?: number;
}

/**
 * YouTube-style volume: a single speaker button that mutes/unmutes, with the
 * slider revealed only while the control is hovered or focused.
 */
export function VolumeControl({ boost = 1 }: VolumeControlProps) {
  const { api, preferences } = usePlayerContext();
  const muted = preferences.muted || preferences.volume === 0;
  const Icon = muted ? VolumeX : preferences.volume < 0.5 ? Volume1 : Volume2;

  return (
    <div className="peak-volume-control">
      <button
        type="button"
        className={`peak-volume-btn${boost > 3 ? ' peak-volume-boost-amber' : ''}`}
        aria-label={muted ? t('unmute') : t('mute')}
        aria-pressed={muted}
        onClick={() => api.setMuted(!preferences.muted).catch(() => undefined)}
      >
        <Icon size={18} />
      </button>
      <div className="peak-volume-slider">
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          aria-label={t('volume')}
          value={preferences.volume}
          onChange={(event) => {
            const value = Number(event.target.value);
            api.setVolume(value).catch(() => undefined);
            if (preferences.muted && value > 0) api.setMuted(false).catch(() => undefined);
          }}
        />
      </div>
    </div>
  );
}
