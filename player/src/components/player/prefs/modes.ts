/**
 * Preference storage modes (spec §9.2.4).
 * - `browser`: persisted in the viewer's localStorage only.
 * - `server`: persisted on the API keyed by the embed viewer id.
 * - `user`: browser defaults, but the viewer can flip on server sync.
 */
export type PreferenceMode = 'browser' | 'server' | 'user';

export const PREFERENCE_MODES: readonly PreferenceMode[] = ['browser', 'server', 'user'];

export function isValidPreferenceMode(value: unknown): value is PreferenceMode {
  return typeof value === 'string' && (PREFERENCE_MODES as readonly string[]).includes(value);
}

/**
 * Resolves the effective preference mode. Precedence: token mode (a partner may
 * force one embed to use `server` even when the global default is `browser`)
 * beats the global mode; a viewer choice only takes effect in `user` mode.
 */
export function resolvePreferenceMode(
  globalMode?: string,
  tokenMode?: string,
  viewerMode?: PreferenceMode | null,
): PreferenceMode {
  if (tokenMode && isValidPreferenceMode(tokenMode)) return tokenMode;
  if (globalMode && isValidPreferenceMode(globalMode)) return globalMode;
  if (viewerMode && isValidPreferenceMode(viewerMode)) return viewerMode;
  return 'browser';
}
