'use client';
import { MenuRoot, type MenuOption } from './MenuRoot';
import { usePlayerContext } from '../PlayerProvider';
import { DEFAULT_KEYMAP, mergeKeymap } from '../../../lib/keymap';
import { t } from '../i18n';

/** Shortcuts menu — lists every keybind from the resolved keymap. */
export function ShortcutsMenu() {
  const { api } = usePlayerContext();
  void api;
  const resolved = mergeKeymap(DEFAULT_KEYMAP);
  const options: MenuOption[] = Object.keys(resolved.map).map((key) => ({
    value: key,
    label: `${key === ' ' ? 'Space' : key} → ${resolved.map[key].join(', ')}`,
  }));
  return (
    <MenuRoot trigger={<span>{t('shortcuts')}</span>} options={options} label={t('shortcuts')} onSelect={() => {}} />
  );
}
