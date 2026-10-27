'use client';
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

  const options: MenuOption[] = sources.map((source) => {
    const codename = codenameForProvider(source.provider) ?? source.provider;
    return { value: codename, label: codename, disabled: source.provider === currentProvider };
  });

  return (
    <MenuRoot
      trigger={<span>{currentProvider ? codenameForProvider(currentProvider) ?? currentProvider : t('server')}</span>}
      options={options}
      selected={currentProvider ? codenameForProvider(currentProvider) ?? currentProvider : null}
      label={t('server')}
      onSelect={(codename) => {
        api.switchServer(codename).catch(() => undefined);
      }}
    />
  );
}
