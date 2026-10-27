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
};

export const MIN_SPEED = 0.25;
export const MAX_SPEED = 2;
export const MAX_BOOST = 5;
export const UNLOCKED_BOOST = 3;
