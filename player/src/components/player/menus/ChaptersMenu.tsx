'use client';
import { MenuRoot, type MenuOption } from './MenuRoot';
import { usePlayerContext } from '../PlayerProvider';
import { t } from '../i18n';

/** Chapters menu — placeholder until chapter metadata is available (spec §12). */
export function ChaptersMenu() {
  const { api } = usePlayerContext();
  const options: MenuOption[] = [{ value: '0', label: t('chapter-1') }];
  void api;
  return (
    <MenuRoot trigger={<span>{t('chapters')}</span>} options={options} selected="0" label={t('chapters')} onSelect={() => {}} />
  );
}
