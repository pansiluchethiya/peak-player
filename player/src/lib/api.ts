import type { Branding, Fingerprint, Media, StreamResponse } from './types';
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

function streamPath(media: Media): string {
  if (media.type === 'tv') return `/api/v1/stream/tv/${encodeURIComponent(media.id)}/${media.season ?? 1}/${media.episode ?? 1}`;
  if (media.type === 'live_tv') return `/api/v1/stream/live_tv/${encodeURIComponent(media.id)}`;
  return `/api/v1/stream/movie/${encodeURIComponent(media.id)}`;
}

function eventsPath(media: Media): string {
  if (media.type === 'tv') return `/api/v1/stream/events/tv/${encodeURIComponent(media.id)}/${media.season ?? 1}/${media.episode ?? 1}`;
  if (media.type === 'live_tv') return `/api/v1/stream/events/live_tv/${encodeURIComponent(media.id)}`;
  return `/api/v1/stream/events/movie/${encodeURIComponent(media.id)}`;
}

export interface StreamEventHandlers {
  onMeta?: (data: { title: string; year?: string | number; group?: string; logo?: string }) => void;
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
  options: { invalidate?: boolean } & StreamEventHandlers = {},
): { close: () => void } {
  const { onMeta, onSource, onSubtitle, onDiagnostic, onDone, onError, invalidate } = options;

  const params = new URLSearchParams({
    fpHash: fingerprint.hash,
    ua: fingerprint.userAgent,
    res: fingerprint.screen,
    tz: fingerprint.timezone,
    lang: fingerprint.language,
  });
  if (invalidate) params.set('invalidate', '1');

  const url = `${base(apiBase)}${eventsPath(media)}?${params.toString()}`;
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
  options: { invalidate?: boolean; signal?: AbortSignal } = {},
): Promise<StreamResponse> {
  const params = new URLSearchParams({
    fpHash: fingerprint.hash,
    ua: fingerprint.userAgent,
    res: fingerprint.screen,
    tz: fingerprint.timezone,
    lang: fingerprint.language,
  });
  if (options.invalidate) params.set('invalidate', '1');

  const response = await fetch(`${base(apiBase)}${streamPath(media)}?${params.toString()}`, {
    signal: options.signal,
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(body || `Stream request failed (${response.status})`);
  }
  return (await response.json()) as StreamResponse;
}
