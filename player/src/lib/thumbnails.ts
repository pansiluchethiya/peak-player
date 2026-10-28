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

/** One cue in a remote `thumbnails.vtt` sprite sheet. */
export interface ThumbnailCue {
  start: number;
  end: number;
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ThumbnailVtt {
  cues: ThumbnailCue[];
  spriteWidth: number;
  spriteHeight: number;
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
 * Parses a remote `thumbnails.vtt` sprite sheet. Cue text is a sprite URL with
 * a Media Fragments `#xywh=x,y,w,h` tile selector, resolved against the VTT.
 */
export function parseThumbnailVtt(input: string, baseUrl: string): ThumbnailVtt | null {
  if (typeof input !== 'string' || !/^WEBVTT/m.test(input.trim())) return null;
  const blocks = input.replace(/\r\n?/g, '\n').split(/\n{2,}/);
  const cues: ThumbnailCue[] = [];
  let spriteWidth = 0;
  let spriteHeight = 0;

  for (const block of blocks) {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
    const timingIndex = lines.findIndex((line) => line.includes('-->'));
    if (timingIndex < 0) continue;
    const [rawStart, rawEnd] = lines[timingIndex].split('-->').map((part) => part.trim().split(/\s+/)[0]);
    const start = parseThumbnailTimestamp(rawStart);
    const end = parseThumbnailTimestamp(rawEnd);
    const imageLine = lines[timingIndex + 1];
    if (start == null || end == null || end <= start || !imageLine) continue;

    const hash = imageLine.indexOf('#xywh=');
    const imageUrl = (hash >= 0 ? imageLine.slice(0, hash) : imageLine).trim();
    const box = hash >= 0 ? imageLine.slice(hash + 6).split('&')[0] : '';
    const [x, y, width, height] = box.split(',').map(Number);
    if (!imageUrl || ![x, y, width, height].every((value) => Number.isFinite(value) && value >= 0)) continue;
    if (width <= 0 || height <= 0) continue;

    let url: string;
    try {
      url = new URL(imageUrl, baseUrl).toString();
    } catch {
      continue;
    }

    cues.push({ start, end, url, x, y, width, height });
    spriteWidth = Math.max(spriteWidth, x + width);
    spriteHeight = Math.max(spriteHeight, y + height);
  }

  if (cues.length === 0 || spriteWidth <= 0 || spriteHeight <= 0) return null;
  return { cues, spriteWidth, spriteHeight };
}

function parseThumbnailTimestamp(value: string | undefined): number | null {
  if (!value) return null;
  const match = /^(?:(\d+):)?(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?$/.exec(value);
  if (!match) return null;
  const hours = match[1] ? Number(match[1]) : 0;
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const millis = match[4] ? Number(match[4].padEnd(3, '0')) : 0;
  return hours * 3600 + minutes * 60 + seconds + millis / 1000;
}

/** Finds the sprite cue covering `time`; assumes cues are sorted by start. */
export function thumbnailCueAt(vtt: ThumbnailVtt | null, time: number): ThumbnailCue | null {
  if (!vtt || vtt.cues.length === 0 || !Number.isFinite(time)) return null;
  let low = 0;
  let high = vtt.cues.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const cue = vtt.cues[mid];
    if (time < cue.start) high = mid - 1;
    else if (time >= cue.end) low = mid + 1;
    else return cue;
  }
  return null;
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
