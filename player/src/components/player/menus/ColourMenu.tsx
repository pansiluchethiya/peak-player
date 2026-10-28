'use client';
import { Palette } from 'lucide-react';
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
  const selected = COLOUR_PRESETS.find((preset) => preset.id === preferences.colourPreset);
  return (
    <MenuRoot
      trigger={
        <>
          <span className="peak-menu-label"><Palette size={14} /><span>{t('colour')}</span></span>
          <span className="peak-menu-value">{selected?.label ?? '—'}</span>
        </>
      }
      options={options}
      selected={preferences.colourPreset}
      label={t('colour')}
      onSelect={(value) => api.setColourPreset(value).catch(() => undefined)}
    />
  );
}
