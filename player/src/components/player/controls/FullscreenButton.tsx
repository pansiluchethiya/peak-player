'use client';
import { useEffect, useState } from 'react';
import { Cast, Maximize, Minimize, PictureInPicture2 } from 'lucide-react';
import { usePlayerContext } from '../PlayerProvider';
import { t } from '../i18n';
import { ControlButton } from './ControlButton';

export function FullscreenButton() {
  const { api } = usePlayerContext();
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      setFullscreen(api.getState().fullscreen);
      frame = window.requestAnimationFrame(tick);
    };
    tick();
    return () => window.cancelAnimationFrame(frame);
  }, [api]);

  return (
    <ControlButton
      aria-label={fullscreen ? t('exit-fullscreen') : t('fullscreen')}
      icon={fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
      onClick={async () => {
        const state = api.getState();
        if (state.fullscreen) await api.exitFullscreen();
        else await api.requestFullscreen();
      }}
    />
  );
}

export function PipButton() {
  const { api } = usePlayerContext();
  return (
    <ControlButton
      aria-label={t('picture-in-picture')}
      icon={<PictureInPicture2 size={18} />}
      onClick={() => api.requestPictureInPicture().catch(() => undefined)}
    />
  );
}

export function CastButton() {
  const { api } = usePlayerContext();
  void api;
  return (
    <ControlButton aria-label={t('cast')} icon={<Cast size={18} />} disabled onClick={() => undefined} />
  );
}
