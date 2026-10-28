'use client';
import { RectangleHorizontal } from 'lucide-react';
import { MenuRoot, type MenuOption } from './MenuRoot';
import { usePlayerContext } from '../PlayerProvider';
import { t } from '../i18n';

/** Aspect ratio menu (spec §6.1). */
export function AspectMenu() {
  const { api, preferences } = usePlayerContext();
  const options: MenuOption[] = [
    { value: 'fit', label: t('aspect-fit') },
    { value: 'fill', label: t('aspect-fill') },
    { value: 'zoom', label: t('aspect-zoom') },
  ];
  const selectedLabel =
    preferences.aspect === 'fill'
      ? t('aspect-fill')
      : preferences.aspect === 'zoom'
        ? t('aspect-zoom')
        : t('aspect-fit');
  return (
    <MenuRoot
      trigger={
        <>
          <span className="peak-menu-label"><RectangleHorizontal size={14} /><span>{t('aspect')}</span></span>
          <span className="peak-menu-value">{selectedLabel}</span>
        </>
      }
      options={options}
      selected={preferences.aspect}
      label={t('aspect')}
      onSelect={(value) => api.setAspect(value as 'fit' | 'fill' | 'zoom').catch(() => undefined)}
    />
  );
}
