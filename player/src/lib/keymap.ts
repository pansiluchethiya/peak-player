/**
 * Keyboard command map (spec §6.2).
 *
 * Bindings are stored as `key -> command[]`. A single key may dispatch
 * multiple commands (e.g. `seekBack` + `volume` on a slider). The handler
 * short-circuits on the first command that prevents default.
 */

export type PlayerCommand =
  | 'togglePlay'
  | 'seekBack'
  | 'seekForward'
  | 'mute'
  | 'fullscreen'
  | 'pip'
  | 'captions'
  | 'speed'
  | 'quality'
  | 'audio'
  | 'colour'
  | 'aspect'
  | 'chapters'
  | 'servers'
  | 'stats'
  | 'shortcuts'
  | 'nextEpisode'
  | 'previousEpisode'
  | 'goLive';

export type KeyMap = Record<string, PlayerCommand[]>;

export const DEFAULT_KEYMAP: KeyMap = {
  ' ': ['togglePlay'],
  k: ['togglePlay'],
  j: ['seekBack'],
  ArrowLeft: ['seekBack'],
  l: ['seekForward'],
  ArrowRight: ['seekForward'],
  m: ['mute'],
  f: ['fullscreen'],
  p: ['pip'],
  c: ['captions'],
  s: ['speed'],
  q: ['quality'],
  a: ['audio'],
  r: ['colour'],
  y: ['aspect'],
  h: ['chapters'],
  v: ['servers'],
  g: ['stats'],
  '?': ['shortcuts'],
  n: ['nextEpisode'],
  b: ['previousEpisode'],
  Home: ['goLive'],
};

export interface ResolvedKeymap {
  map: KeyMap;
  handleKeydown(event: KeyboardEvent): boolean;
}

/** Resolve a key to its command list, honouring modifiers minimally. */
export function commandForKey(map: KeyMap, key: string): PlayerCommand[] | undefined {
  return map[key];
}

/**
 * Merge custom bindings (shallow overlay). Returns a callable map with a
 * `handleKeydown` guard that ignores keys typed into form fields.
 */
export function mergeKeymap(base: KeyMap, overlay?: KeyMap): ResolvedKeymap {
  const map: KeyMap = { ...base, ...overlay };

  const isInForm = (event: KeyboardEvent): boolean => {
    const target = event.target as HTMLElement | null;
    if (!target) return false;
    const tag = target.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    return target.contentEditable === 'true';
  };

  return {
    map,
    handleKeydown(event: KeyboardEvent): boolean {
      if (isInForm(event)) return false;
      const commands = commandForKey(map, event.key);
      if (!commands || commands.length === 0) return false;
      for (const command of commands) {
        event.preventDefault();
        event.stopPropagation();
      }
      return true;
    },
  };
}

/** Default handler bound to the player stage. */
export function defaultKeymapHandler(): (event: KeyboardEvent) => boolean {
  const resolved = mergeKeymap(DEFAULT_KEYMAP);
  return (event: KeyboardEvent) => resolved.handleKeydown(event);
}
