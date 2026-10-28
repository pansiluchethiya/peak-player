import type { Branding, Fingerprint, Media, MediaMetadata, StreamResponse } from './types';
import { DEFAULT_BRANDING } from './types';


function base(apiBase: string): string {
  return apiBase.replace(/\/+$/, '');
}

export async function fetchBranding(apiBase: string, signal?: AbortSignal): Promise<Branding> {
  try {
    const response = await fetch(`${base(apiBase)}/api/v1/branding`, { signal });
    if (!response.ok) return DEFAULT_BRANDING;
    const data = (await response.json()) as Partial<Branding>;
    return { ...DEFAULT_BRANDING, ...data };
  } catch {
    return DEFAULT_BRANDING;
  }
}

function streamUrl(prefix: string, media: Media, options: { source?: string }): string {
  const params = new URLSearchParams();
  let path: string;
  if (media.type === 'tv') {
    path = `${prefix}/tv/${encodeURIComponent(media.id)}`;
    params.set('season', String(media.season ?? 1));
    params.set('episode', String(media.episode ?? 1));
  } else if (media.type === 'live_tv') {
    path = `${prefix}/live_tv/${encodeURIComponent(media.id)}`;
  } else {
    path = `${prefix}/movie/${encodeURIComponent(media.id)}`;
  }
  if (options.source) params.set('source', options.source);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function streamPath(media: Media, options: { source?: string } = {}): string {
  return streamUrl('/api/v1/stream', media, options);
}

export function eventsPath(media: Media, options: { source?: string } = {}): string {
  return streamUrl('/api/v1/stream/events', media, options);
}

export interface StreamEventHandlers {
  onMeta?: (data: {
    title: string;
    year?: string | number;
    runtime?: number;
    overview?: string;
    group?: string;
    logo?: string;
    media?: MediaMetadata;
  }) => void;
  onSource?: (source: { url: string; quality: string; codec: string; provider: string; adaptive?: boolean; expiresIn: number }) => void;
  onSubtitle?: (subtitle: { url: string; lang: string; label: string; provider: string }) => void;
  onDiagnostic?: (diagnostic: { provider: string; ok: boolean; latencyMs: number; error?: string }) => void;
  onDone?: (data: { meta: { providers: number; sources: number; subtitles: number; latencyMs: number; cacheHit: boolean }; diagnostics: { provider: string; ok: boolean; latencyMs: number; error?: string }[] }) => void;
  onError?: (error: { error: string; message: string }) => void;
}

export function fetchStreamEvents(
  apiBase: string,
  media: Media,
  fingerprint: Fingerprint,
  options: { invalidate?: boolean; embed?: boolean; source?: string } & StreamEventHandlers = {},
): { close: () => void } {
  const { onMeta, onSource, onSubtitle, onDiagnostic, onDone, onError, invalidate, embed, source: selectedSource } = options;

  const params = new URLSearchParams({
    fpHash: fingerprint.hash,
    ua: fingerprint.userAgent,
    res: fingerprint.screen,
    tz: fingerprint.timezone,
    lang: fingerprint.language,
  });
  if (invalidate) params.set('invalidate', '1');
  if (embed) params.set('embed', '1');

  const path = eventsPath(media, { source: selectedSource });
  const separator = path.includes('?') ? '&' : '?';
  const url = `${base(apiBase)}${path}${separator}${params.toString()}`;
  const source = new EventSource(url);

  const handleMessage = <T>(event: string, handler?: (data: T) => void) => {
    source.addEventListener(event, (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as T;
        handler?.(data);
      } catch {
        // Ignore malformed SSE data
      }
    });
  };

  handleMessage('meta', onMeta);
  handleMessage('source', onSource);
  handleMessage('subtitle', onSubtitle);
  handleMessage('diagnostic', onDiagnostic);
  handleMessage('done', onDone);
  handleMessage('error', onError);

  let transportErrorEmitted = false;
  source.onerror = () => {
    if (!transportErrorEmitted) {
      transportErrorEmitted = true;
      onError?.({ error: 'TRANSPORT_ERROR', message: 'Connection to stream service failed' });
    }
    source.close();
  };

  return {
    close: () => {
      source.close();
    },
  };
}

export async function fetchStream(
  apiBase: string,
  media: Media,
  fingerprint: Fingerprint,
  options: { invalidate?: boolean; signal?: AbortSignal; source?: string } = {},
): Promise<StreamResponse> {
  const params = new URLSearchParams({
    fpHash: fingerprint.hash,
    ua: fingerprint.userAgent,
    res: fingerprint.screen,
    tz: fingerprint.timezone,
    lang: fingerprint.language,
  });
  if (options.invalidate) params.set('invalidate', '1');

  const path = streamPath(media, { source: options.source });
  const separator = path.includes('?') ? '&' : '?';
  const response = await fetch(`${base(apiBase)}${path}${separator}${params.toString()}`, {
    signal: options.signal,
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(body || `Stream request failed (${response.status})`);
  }
  return (await response.json()) as StreamResponse;
}
