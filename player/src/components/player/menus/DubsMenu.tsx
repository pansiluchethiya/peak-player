'use client';
import { Languages } from 'lucide-react';
import { MenuRoot, type MenuOption } from './MenuRoot';
import { usePlayerContext } from '../PlayerProvider';
import { t } from '../i18n';

/** Language-specific renditions exposed by providers such as Rive Citadel. */
export function DubsMenu() {
  const { api, payload } = usePlayerContext();
  const sources = payload?.sources ?? [];
  const currentIndex = api.getState().sourceIndex;
  const current = sources[currentIndex];

  const options: MenuOption[] = [];
  const seen = new Set<string>();
  const englishIndex = sources.findIndex((source) => !source.dub);
  if (englishIndex >= 0) {
    options.push({ value: String(englishIndex), label: t('dub-english') });
    seen.add(t('dub-english').toLowerCase());
  }
  sources.forEach((source, index) => {
    if (!source.dub) return;
    const key = source.dub.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    options.push({ value: String(index), label: source.dub });
  });

  const selectedLabel = current?.dub ?? (englishIndex >= 0 ? t('dub-english') : '—');
  return (
    <MenuRoot
      trigger={
        <>
          <span className="peak-menu-label"><Languages size={14} /><span>{t('dubs')}</span></span>
          <span className="peak-menu-value">{selectedLabel}</span>
        </>
      }
      options={options}
      selected={current ? String(currentIndex >= 0 ? currentIndex : 0) : null}
      label={t('dubs')}
      onSelect={(value) => api.switchSource(Number(value)).catch(() => undefined)}
    />
  );
}
