/**
 * Share link builder (spec §12).
 *
 * Builds `/embed/{type}/{id}` URLs with optional season/episode and
 * query params for provider source + autoplay preference.
 */

export interface ShareOptions {
  origin: string;
  type: 'movie' | 'tv' | 'live_tv';
  id: string;
  season?: number;
  episode?: number;
  source?: string;
  autoPlay?: boolean;
  v?: number;
}

export function encodeEmbedParams(params: Record<string, string | number | boolean>): string {
  const pairs: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return pairs.join('&');
}

export function buildShareLink(options: ShareOptions): string {
  const { origin, type, id, season, episode, source, autoPlay, v } = options;
  let path: string;
  if (type === 'tv') {
    const s = season ?? 1;
    const e = episode ?? 1;
    path = `/embed/tv/${encodeURIComponent(id)}/${s}/${e}`;
  } else if (type === 'live_tv') {
    path = `/embed/live/${encodeURIComponent(id)}`;
  } else {
    path = `/embed/movie/${encodeURIComponent(id)}`;
  }

  const params: Record<string, string | number | boolean> = {};
  if (autoPlay !== undefined) params.autoPlay = autoPlay;
  if (source) params.source = source;
  if (v !== undefined) params.v = v;

  const query = encodeEmbedParams(params);
  return query ? `${origin}${path}?${query}` : `${origin}${path}`;
}
