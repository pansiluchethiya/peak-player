'use client';
import { Timer } from 'lucide-react';
import { MenuRoot, type MenuOption } from './MenuRoot';
import { usePlayerContext } from '../PlayerProvider';
import { t } from '../i18n';

export function SpeedMenu() {
  const { api, preferences } = usePlayerContext();
  const options: MenuOption[] = [
    { value: '0.25', label: '0.25x' },
    { value: '0.5', label: '0.5x' },
    { value: '0.75', label: '0.75x' },
    { value: '1', label: '1x' },
    { value: '1.25', label: '1.25x' },
    { value: '1.5', label: '1.5x' },
    { value: '1.75', label: '1.75x' },
    { value: '2', label: '2x' },
  ];
  return (
    <MenuRoot
      trigger={
        <>
          <span className="peak-menu-label"><Timer size={14} /><span>{t('speed')}</span></span>
          <span className="peak-menu-value">{preferences.speed}x</span>
        </>
      }
      options={options}
      selected={String(preferences.speed)}
      label={t('speed')}
      onSelect={(value) => api.setSpeed(Number(value)).catch(() => undefined)}
    />
  );
}
