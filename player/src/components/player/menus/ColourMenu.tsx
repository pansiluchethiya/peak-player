'use client';
import { MenuRoot, type MenuOption } from './MenuRoot';
import { usePlayerContext } from '../PlayerProvider';
import { COLOUR_PRESETS } from '../colour/presets';
import { t } from '../i18n';

export function ColourMenu() {
  const { api, preferences } = usePlayerContext();
  const options: MenuOption[] = COLOUR_PRESETS.map((preset) => ({
    value: preset.id,
    label: preset.label,
  }));
  return (
    <MenuRoot
      trigger={<span>{t('colour')}</span>}
      options={options}
      selected={preferences.colourPreset}
      label={t('colour')}
      onSelect={(value) => api.setColourPreset(value).catch(() => undefined)}
    />
  );
}
