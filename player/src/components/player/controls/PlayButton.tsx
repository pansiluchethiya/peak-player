'use client';
import { useEffect, useState } from 'react';
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
      aria-label={playing ? t('pause') : t('play')}
      icon={playing ? '❚❚' : '▶'}
      onClick={() => (playing ? api.pause() : api.play()).catch(() => undefined)}
    />
  );
}
