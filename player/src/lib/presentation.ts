import type { PlayerPreferences } from '../components/player/prefs/schema';

export interface AutoplayPolicy {
  shouldPlay: boolean;
  muted: boolean;
}

/**
 * Browsers only guarantee autoplay when the media is muted, so every autoplay
 * attempt starts muted regardless of the stored mute preference.
 */
export function autoplayPolicy(
  preferences: Pick<PlayerPreferences, 'autoplay' | 'muted'>,
): AutoplayPolicy {
  return { shouldPlay: preferences.autoplay, muted: true };
}

/** The paused poster appears after 800 ms and only after playback has started. */
export function pausedPosterVisible(pausedForMs: number, hasPlayed: boolean): boolean {
  return hasPlayed && pausedForMs >= 800;
}
