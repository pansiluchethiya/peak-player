import type { Source } from './types';

/** Stable key for an attempted source. URLs are the identity; index is the fallback. */
export function sourceKey(source: Source | undefined, index: number): string {
  return source?.url || `${source?.provider || 'unknown'}:${index}`;
}

/** A source the browser can actually attempt. MKV is not browser-playable. */
export function isPlayableSource(source: Source | undefined): boolean {
  if (!source?.url) return false;
  if (source.codec === 'mkv' || source.container === 'mkv') return false;
  return source.browserPlayable !== false;
}

/**
 * Returns the next source that has not been attempted and is browser-playable.
 * Wraps around once; returns -1 when every candidate is exhausted.
 */
export function nextSourceIndex(
  sources: Source[],
  currentIndex: number,
  attempted: ReadonlySet<string>,
): number {
  if (!sources.length) return -1;
  for (let offset = 1; offset <= sources.length; offset += 1) {
    const index = (currentIndex + offset) % sources.length;
    if (!attempted.has(sourceKey(sources[index], index)) && isPlayableSource(sources[index])) {
      return index;
    }
  }
  return -1;
}
