'use client';
import { MenuRoot, type MenuOption } from './MenuRoot';
import { usePlayerContext } from '../PlayerProvider';
import { t } from '../i18n';

export function CaptionsMenu() {
  const { api, preferences, subtitles } = usePlayerContext();
  const trackOptions: MenuOption[] = subtitles.map((sub) => ({
    value: sub.label,
    label: sub.label,
  }));
  if (!subtitles.find((s) => s.label === preferences.captions.language)) {
    trackOptions.unshift({ value: 'off', label: t('captions-off') });
  }
  return (
    <MenuRoot
      trigger={<span>{t('captions')}</span>}
      options={trackOptions}
      selected={preferences.captions.language ?? 'off'}
      label={t('captions')}
      onSelect={(value) => {
        const track = subtitles.find((s) => s.label === value);
        if (value === 'off' || !track) {
          api.setCaptions({ enabled: false }).catch(() => undefined);
        } else {
          api.setCaptions({ enabled: true, language: track.lang ?? track.label }).catch(() => undefined);
        }
      }}
    />
  );
}
