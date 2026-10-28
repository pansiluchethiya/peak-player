'use client';
import { Gauge } from 'lucide-react';
import { MenuRoot, type MenuOption } from './MenuRoot';
import { usePlayerContext } from '../PlayerProvider';
import { t } from '../i18n';

const QUALITY_VALUES = [
  { value: 'auto', key: 'quality-auto' },
  { value: '360p', key: 'quality-360' },
  { value: '480p', key: 'quality-480' },
  { value: '720p', key: 'quality-720' },
  { value: '1080p', key: 'quality-1080' },
] as const;

export function QualityMenu() {
  const { api, preferences } = usePlayerContext();
  const options: MenuOption[] = QUALITY_VALUES.map(({ value, key }) => ({ value, label: t(key) }));
  const selected = options.find((quality) => quality.value === preferences.quality) ?? options[0];
  return (
    <MenuRoot
      trigger={
        <>
          <span className="peak-menu-label"><Gauge size={14} /><span>{t('quality')}</span></span>
          <span className="peak-menu-value">{selected?.label ?? t('quality-auto')}</span>
        </>
      }
      options={options}
      selected={preferences.quality}
      label={t('quality')}
      onSelect={(value) => api.setQuality(value).catch(() => undefined)}
    />
  );
}
