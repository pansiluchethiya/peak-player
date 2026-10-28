/**
 * Provider codenames (spec §6.6).
 *
 * Partners and viewers only ever see the codename; the real provider id is
 * resolved server-side so the provider list is never leaked to the client.
 */

export const SERVER_CODENAMES = new Map<string, string>([
  ['netmirror', 'NOVA'],
  ['vixsrc', 'VESPER'],
  ['vidlink', 'ORION'],
  ['videasy', 'LYRA'],
  ['zxcstreams', 'KESTREL'],
  ['vaplayer', 'HALCYON'],
  ['showbox', 'MERIDIAN'],
  ['4khdhub', 'ATLAS'],
  ['castletv', 'CITADEL'],
  ['dahmermovies', 'DUNE'],
  ['hdghartv', 'HELIOS'],
  ['onetouchtv', 'ONYX'],
  ['streamflix', 'NOCTIS'],
  ['rive apogee', 'PRIME'],
  ['rive vanguard', 'STELLAR'],
  ['rive pulse', 'NEXUS'],
  ['rive citadel', 'ORBIT'],
]);

/** Sorted codename -> provider (reverse lookup), built once. */
const CODENAME_TO_PROVIDER = new Map<string, string>();
for (const [provider, codename] of SERVER_CODENAMES) {
  CODENAME_TO_PROVIDER.set(codename.toLowerCase(), provider);
}

/** Resolve a provider id to its codename, or `null`. */
export function codenameForProvider(provider: string | null | undefined): string | null {
  if (!provider) return null;
  return SERVER_CODENAMES.get(provider.toLowerCase()) ?? null;
}

/** Resolve a codename (case-insensitive) to its provider id, or `null`. */
export function providerForCodename(codename: string | null | undefined): string | null {
  if (!codename) return null;
  return CODENAME_TO_PROVIDER.get(codename.toLowerCase()) ?? null;
}
