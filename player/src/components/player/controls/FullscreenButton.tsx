'use client';
import { usePlayerContext } from '../PlayerProvider';
import { t } from '../i18n';
import { ControlButton } from './ControlButton';

export function FullscreenButton() {
  const { api } = usePlayerContext();
  return (
    <ControlButton
      aria-label={t('fullscreen')}
      icon="⛶"
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
    <ControlButton aria-label={t('picture-in-picture')} icon="⬤" onClick={() => api.requestPictureInPicture().catch(() => undefined)} />
  );
}

export function CastButton() {
  const { api } = usePlayerContext();
  void api;
  return (
    <ControlButton aria-label={t('cast')} icon="📺" disabled onClick={() => undefined} />
  );
}
