'use client';
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
      trigger={<span>{t('audio')}</span>}
      options={options}
      selected={preferences.audioTrack ?? 'default'}
      label={t('audio')}
      onSelect={(value) => api.setAudioTrack(value).catch(() => undefined)}
    />
  );
}
