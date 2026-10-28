/**
 * TMDB poster paths arrive from the API as `/abc123.jpg`. The API stores the
 * raw path so the consumer can choose an image size; the player must turn it
 * into an absolute URL, otherwise the browser resolves it against the player
 * origin and gets a 404.
 */
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

export function absoluteArtwork(value?: string | null): string | undefined {
  if (typeof value !== 'string') return undefined;
  const url = value.trim();
  if (!url) return undefined;
  if (url.startsWith('/')) return `${TMDB_IMAGE_BASE}${url}`;
  return url;
}
