import type { Media, Source } from '../../../lib/types';

export type EngineKind = 'hls' | 'native' | 'external';

export interface EngineSource {
  kind: EngineKind;
  src: string;
  type?: string;
  streamType: 'on-demand' | 'live' | 'unknown';
}

const HLS_MIME_TYPE = 'application/vnd.apple.mpegurl';

function isHlsUrl(url: string): boolean {
  const path = url.split(/[?#]/, 1)[0]?.toLowerCase() ?? '';
  return path.endsWith('.m3u8');
}

/**
 * Maps a backend source onto the media engine that should play it.
 *
 * The adapter is pure: it never touches the DOM and can be unit tested on the
 * server. HLS is preferred whenever the source is adaptive, declares an HLS
 * container, or has an `.m3u8` path; progressive files go to the browser's
 * native video element, and anything else is delegated to an external page.
 */
export function engineSource(source: Source, media: Media): EngineSource {
  const streamType = media.type === 'live_tv' ? 'live' : 'on-demand';
  const codec = source.codec.toLowerCase();
  const container = source.container?.toLowerCase();
  const browserPlayable = source.browserPlayable !== false;

  if (codec === 'html5' || !browserPlayable) {
    return { kind: 'external', src: source.url, streamType };
  }

  if (source.adaptive === true || container === 'hls' || isHlsUrl(source.url)) {
    return { kind: 'hls', src: source.url, type: HLS_MIME_TYPE, streamType };
  }

  if (codec === 'mp4' || codec === 'webm' || browserPlayable) {
    return { kind: 'native', src: source.url, streamType };
  }

  // Final fallback: browserPlayable was normalised into a boolean above, so this
  // only catches a source that none of the earlier branches claimed.
  return { kind: 'external', src: source.url, streamType };
}
