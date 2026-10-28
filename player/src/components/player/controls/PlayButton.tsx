'use client';
import { useEffect, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { usePlayerContext } from '../PlayerProvider';
import { t } from '../i18n';
import { ControlButton } from './ControlButton';

export function PlayButton() {
  const { api } = usePlayerContext();
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const state = api.getState();
      setPlaying(state.playing);
      frame = window.requestAnimationFrame(tick);
    };
    tick();
    return () => window.cancelAnimationFrame(frame);
  }, [api]);

  return (
    <ControlButton
      className="peak-control-btn peak-play-btn"
      aria-label={playing ? t('pause') : t('play')}
      icon={playing ? <Pause size={19} fill="currentColor" strokeWidth={0} /> : <Play size={19} fill="currentColor" strokeWidth={0} />}
      onClick={() => (playing ? api.pause() : api.play()).catch(() => undefined)}
    />
  );
}
