'use client';
import { useEffect, useState } from 'react';
import { usePlayerContext } from '../PlayerProvider';

/** Up-next overlay shown when autoplayNext is enabled (spec §12). */
export function UpNextOverlay() {
  const { api, preferences, media } = usePlayerContext();
  const [visible, setVisible] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (media.type !== 'tv' || !preferences.autoplayNext) {
      setVisible(false);
      return;
    }
    const state = api.getState();
    if (state.duration && state.currentTime >= state.duration - 8) {
      setVisible(true);
      setCountdown(Math.max(0, Math.round(state.duration - state.currentTime)));
    } else {
      setVisible(false);
    }
  }, [api, media.type, preferences.autoplayNext]);

  if (!visible) return null;
  return (
    <div className="peak-upnext-overlay" role="status">
      <span>Next episode in {countdown}s</span>
      <button type="button" onClick={() => api.nextEpisode().catch(() => undefined)}>Play now</button>
    </div>
  );
}
