import type { Media, MediaMetadata } from './types';

function base(apiBase: string): string {
  return apiBase.replace(/\/+$/, '');
}

/**
 * `/api/v1/media` only serves movie and TV metadata. Live channels have no
 * resolver record, so they use the movie shape and the request fails cleanly.
 */
export function mediaPath(media: Media): string {
  const type = media.type === 'tv' ? 'tv' : 'movie';
  const params = new URLSearchParams();
  const path = `/api/v1/media/${type}/${encodeURIComponent(media.id)}`;
  if (type === 'tv') {
    params.set('season', String(media.season ?? 1));
    params.set('episode', String(media.episode ?? 1));
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export async function fetchMedia(
  apiBase: string,
  media: Media,
  signal?: AbortSignal,
): Promise<MediaMetadata> {
  const response = await fetch(`${base(apiBase)}${mediaPath(media)}`, { signal });
  if (!response.ok) {
    throw new Error(`Media request failed (${response.status})`);
  }
  const body = (await response.json()) as {
    success?: boolean;
    media?: MediaMetadata;
    error?: string;
  };
  if (!body || body.success === false || !body.media) {
    throw new Error(body?.error || 'Media request failed');
  }
  return body.media;
}
