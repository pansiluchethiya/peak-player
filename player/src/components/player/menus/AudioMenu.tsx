'use client';
import { AudioLines } from 'lucide-react';
import { MenuRoot, type MenuOption } from './MenuRoot';
import { usePlayerContext } from '../PlayerProvider';
import { t } from '../i18n';

/** Audio track menu. Track ids come from the engine's audio track list, exposed here via state. */
export function AudioMenu() {
  const { api, preferences } = usePlayerContext();
  const state = api.getState();
  const tracks = state.audioTrack ? [{ value: state.audioTrack, label: state.audioTrack }] : [];
  const options: MenuOption[] = [
    { value: 'default', label: t('audio-default') },
    ...tracks.map((track) => ({ value: track.value, label: track.label })),
  ];
  return (
    <MenuRoot
      trigger={
        <>
          <span className="peak-menu-label"><AudioLines size={14} /><span>{t('audio')}</span></span>
          <span className="peak-menu-value">{preferences.audioTrack ?? t('audio-default')}</span>
        </>
      }
      options={options}
      selected={preferences.audioTrack ?? 'default'}
      label={t('audio')}
      onSelect={(value) => api.setAudioTrack(value).catch(() => undefined)}
    />
  );
}
