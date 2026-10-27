'use client';
import { MenuRoot, type MenuOption } from './MenuRoot';
import { usePlayerContext } from '../PlayerProvider';
import { t } from '../i18n';

export function QualityMenu() {
  const { api, payload, preferences } = usePlayerContext();
  const sources = payload?.sources ?? [];
  const qualities: MenuOption[] =
    sources.length > 0
      ? [
          { value: 'auto', label: t('quality-auto') },
          ...Array.from(new Set(sources.map((s) => s.quality))).map((q) => ({ value: q, label: q })),
        ]
      : [{ value: 'auto', label: t('quality-auto') }];
  return (
    <MenuRoot
      trigger={<span aria-label={t('quality')}>{t('quality')}</span>}
      options={qualities}
      selected={preferences.quality}
      label={t('quality')}
      onSelect={(value) => api.setQuality(value).catch(() => undefined)}
    />
  );
}
