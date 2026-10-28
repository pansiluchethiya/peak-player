'use client';
import { Server } from 'lucide-react';
import { MenuRoot, type MenuOption } from './MenuRoot';
import { usePlayerContext } from '../PlayerProvider';
import { codenameForProvider, providerForCodename } from '../../../lib/servers';
import { t } from '../i18n';

/**
 * Server switcher (spec §6.6 / D8). Lists codenames only — the provider id
 * is never leaked to the viewer. Selecting a codename re-resolves the source
 * via `api.switchServer(codename)`.
 */
export function ServerMenu() {
  const { api, payload, preferences } = usePlayerContext();
  const sources = payload?.sources ?? [];
  const currentProvider = preferences.server ?? sources[0]?.provider ?? null;
  const currentCodename = currentProvider
    ? codenameForProvider(currentProvider) ?? currentProvider
    : null;

  const options: MenuOption[] = sources.map((source) => {
    const codename = codenameForProvider(source.provider) ?? source.provider;
    return { value: codename, label: codename, disabled: source.provider === currentProvider };
  });

  return (
    <MenuRoot
      trigger={
        <>
          <span className="peak-menu-label"><Server size={14} /><span>{t('server')}</span></span>
          <span className="peak-menu-value">{currentCodename ?? '—'}</span>
        </>
      }
      options={options}
      selected={currentCodename}
      label={t('server')}
      onSelect={(codename) => {
        api.switchServer(codename).catch(() => undefined);
      }}
    />
  );
}
