import type { Media } from './types';

/**
 * Scrub previews prefer the HLS image playlist when the manifest ships one and
 * fall back to the cached ffmpeg sprite endpoint. Neither path may throw into
 * the player: a missing sprite simply means the scrubber shows time only.
 */
export interface ImageTracks {
  url: string;
  tileWidth: number;
  tileHeight: number;
  columns: number;
  rows: number;
  duration: number;
}

const IMAGE_STREAM_TAG = '#EXT-X-IMAGE-STREAM-INF:';
const TILES_TAG = '#EXT-X-TILES:';
const ATTRIBUTE_PATTERN = /([A-Z0-9-]+)=("[^"]*"|[^,]*)/g;

function base(apiBase: string): string {
  return apiBase.replace(/\/+$/, '');
}

function readAttributes(line: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  let match: RegExpExecArray | null;
  ATTRIBUTE_PATTERN.lastIndex = 0;
  while ((match = ATTRIBUTE_PATTERN.exec(line)) !== null) {
    attributes[match[1]] = match[2].replace(/^"|"$/g, '');
  }
  return attributes;
}

function parseSize(value: string | undefined): { width: number; height: number } | null {
  if (!value) return null;
  const match = /^(\d+)x(\d+)$/i.exec(value);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  return width > 0 && height > 0 ? { width, height } : null;
}

/**
 * Parses `#EXT-X-IMAGE-STREAM-INF` + `#EXT-X-TILES` from a master playlist.
 * Both tags are required; the URI is resolved relative to the manifest.
 */
export function parseImageTracks(manifest: string, baseUrl: string): ImageTracks | null {
  if (typeof manifest !== 'string' || !manifest) return null;
  const lines = manifest.split(/\r?\n/);
  const imageLine = lines.find((line) => line.startsWith(IMAGE_STREAM_TAG));
  const tilesLine = lines.find((line) => line.startsWith(TILES_TAG));
  if (!imageLine || !tilesLine) return null;

  const image = readAttributes(imageLine);
  const tiles = readAttributes(tilesLine);
  if (!image.URI) return null;

  const size = parseSize(tiles.RESOLUTION) ?? parseSize(image.RESOLUTION);
  const grid = parseSize(tiles.LAYOUT);
  const duration = Number(tiles.DURATION);
  if (!size || !grid || !Number.isFinite(duration) || duration <= 0) return null;

  let url: string;
  try {
    url = new URL(image.URI, baseUrl).toString();
  } catch {
    return null;
  }

  return {
    url,
    tileWidth: size.width,
    tileHeight: size.height,
    columns: grid.width,
    rows: grid.height,
    duration,
  };
}

/**
 * Requests a server-generated sprite for the first playable source. Returns an
 * absolute URL, or `null` when sprites are unavailable.
 */
export async function fetchSprite(
  apiBase: string,
  media: Media,
  duration: number,
): Promise<string | null> {
  if (media.type !== 'movie' && media.type !== 'tv') return null;
  const seconds = Number(duration);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;

  try {
    const response = await fetch(
      `${base(apiBase)}/api/v1/thumbnails/${media.type}/${encodeURIComponent(media.id)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          season: media.type === 'tv' ? media.season ?? 1 : undefined,
          episode: media.type === 'tv' ? media.episode ?? 1 : undefined,
          duration: Math.round(seconds),
        }),
      },
    );
    if (!response.ok) return null;
    const body = (await response.json()) as { success?: boolean; url?: string };
    if (!body || body.success !== true || typeof body.url !== 'string') return null;
    return body.url.startsWith('/') ? `${base(apiBase)}${body.url}` : body.url;
  } catch {
    return null;
  }
}
