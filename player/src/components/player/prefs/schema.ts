/**
 * Player preference schema (spec §9.2).
 *
 * The shape is the contract shared by the player, the embed SDK, and the admin
 * provider defaults. Persistence, migration (`v: 1`) and the three storage modes
 * land in Task 16; this module only defines the values and defaults every surface
 * reads today.
 */

export type CaptionSize = 'sm' | 'md' | 'lg' | 'xl';
export type CaptionEdge = 'none' | 'shadow' | 'outline' | 'background';

export interface CaptionPreferences {
  enabled: boolean;
  language: string | null;
  size: CaptionSize;
  /** 0..1 */
  opacity: number;
  edge: CaptionEdge;
  mica: boolean;
}

export type AspectMode = 'fit' | 'fill' | 'zoom';

export interface PlayerPreferences {
  /** 0..1 */
  volume: number;
  muted: boolean;
  /** 0..5 (0..3 normal, up to 5 when unlocked) */
  boost: number;
  boostUnlocked: boolean;
  /** 0.25..2 */
  speed: number;
  /** `'auto'` or a rendition id */
  quality: 'auto' | string;
  audioTrack: string | null;
  captions: CaptionPreferences;
  colourPreset: string;
  aspect: AspectMode;
  autoplayNext: boolean;
  autoplay: boolean;
  locale: string;
  /** Currently selected provider codename (if any). */
  server: string | null;
}

export const DEFAULT_PREFERENCES: PlayerPreferences = {
  volume: 1,
  muted: true,
  boost: 1,
  boostUnlocked: false,
  speed: 1,
  quality: 'auto',
  audioTrack: null,
  captions: {
    enabled: false,
    language: null,
    size: 'md',
    opacity: 1,
    edge: 'none',
    mica: true,
  },
  colourPreset: 'cinema',
  aspect: 'fit',
  autoplayNext: true,
  autoplay: true,
  locale: 'en',
  server: null,
};

export const MIN_SPEED = 0.25;
export const MAX_SPEED = 2;
export const MAX_BOOST = 5;
export const UNLOCKED_BOOST = 3;

const PREFERENCE_KEYS: (keyof PlayerPreferences)[] = [
  'volume', 'muted', 'boost', 'boostUnlocked', 'speed', 'quality', 'audioTrack',
  'captions', 'colourPreset', 'aspect', 'autoplayNext', 'autoplay', 'locale',
];

const CAPTION_SIZES: CaptionSize[] = ['sm', 'md', 'lg', 'xl'];
const CAPTION_EDGES: CaptionEdge[] = ['none', 'shadow', 'outline', 'background'];
const ASPECT_MODES: AspectMode[] = ['fit', 'fill', 'zoom'];

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(Math.max(n, min), max);
}

function pickEnum<T>(value: unknown, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly unknown[]).includes(value) ? (value as T) : fallback;
}

export function migratePreferences(raw: unknown): PlayerPreferences {
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const captionsInput = input.captions && typeof input.captions === 'object'
    ? (input.captions as Record<string, unknown>)
    : {};
  const captions: CaptionPreferences = {
    enabled: captionsInput.enabled === false ? false : true,
    language: typeof captionsInput.language === 'string' ? (captionsInput.language as string) : null,
    size: pickEnum(captionsInput.size, CAPTION_SIZES, 'md'),
    opacity: clamp(captionsInput.opacity, 0, 1, 1),
    edge: pickEnum(captionsInput.edge, CAPTION_EDGES, 'none'),
    mica: captionsInput.mica === false ? false : true,
  };
  return {
    volume: clamp(input.volume, 0, 1, 1),
    muted: input.muted === false ? false : true,
    boost: clamp(input.boost, 0, MAX_BOOST, 1),
    boostUnlocked: input.boostUnlocked === true,
    speed: pickEnum(input.speed, [0.25, 0.5, 0.75, 1, 1.25, 1.5, 175, 2], clamp(input.speed, MIN_SPEED, MAX_SPEED, 1)) as number,
    quality: typeof input.quality === 'string' && input.quality ? input.quality : 'auto',
    audioTrack: typeof input.audioTrack === 'string' ? (input.audioTrack as string) : null,
    captions,
    colourPreset: typeof input.colourPreset === 'string' && input.colourPreset ? (input.colourPreset as string) : 'cinema',
    aspect: pickEnum(input.aspect, ASPECT_MODES, 'fit'),
    autoplayNext: input.autoplayNext === false ? false : true,
    autoplay: input.autoplay === false ? false : true,
    locale: typeof input.locale === 'string' && input.locale ? (input.locale as string) : 'en',
    server: typeof input.server === 'string' && input.server ? (input.server as string) : null,
  };
}

export function mergePreferences(base: PlayerPreferences, patch: unknown): PlayerPreferences {
  if (!patch || typeof patch !== 'object') return base;
  return migratePreferences({ ...base, ...(patch as Record<string, unknown>) });
}

export interface ResolvePreferencesInput {
  defaults: PlayerPreferences;
  partner?: Partial<PlayerPreferences>;
  user?: Partial<PlayerPreferences>;
  locked?: string[];
}

export function resolvePreferences(input: ResolvePreferencesInput): PlayerPreferences {
  const { defaults, partner, user, locked = [] } = input;
  const patch: Record<string, unknown> = { ...partner, ...user };
  for (const key of locked) {
    // Locked keys fall back to the partner value when present, else the default.
    const partnerValue = partner ? partner[key as keyof PlayerPreferences] : undefined;
    if (partnerValue !== undefined) {
      patch[key as string] = partnerValue;
    } else {
      delete patch[key as string];
    }
  }
  return migratePreferences({ ...defaults, ...patch });
}

