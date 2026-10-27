'use client';
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
  return (
    <MenuRoot
      trigger={<span>{t('aspect')}</span>}
      options={options}
      selected={preferences.aspect}
      label={t('aspect')}
      onSelect={(value) => api.setAspect(value as 'fit' | 'fill' | 'zoom').catch(() => undefined)}
    />
  );
}
