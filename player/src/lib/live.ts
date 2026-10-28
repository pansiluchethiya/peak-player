import type { EpgProgramme } from './types';

// Re-export the public EPG shapes so consumers import from `live`.
export type { EpgProgramme } from './types';

export interface LiveEpg {
  now: EpgProgramme | null;
  next: EpgProgramme | null;
  schedule: EpgProgramme[];
}

/**
 * `channelId` is the playlist channel id. The live EPG route is keyed by the
 * same id, so this maps directly onto `/api/v1/live/tv/epg/:id`.
 */
function parseEpg(raw: unknown, channelId: string): EpgProgramme | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const start = typeof r.start === 'string' ? r.start : null;
  const stop = typeof r.stop === 'string' ? r.stop : null;
  const title = typeof r.title === 'string' ? r.title : '';
  if (start === null || stop === null) return null;
  return {
    channelId,
    start,
    stop,
    title,
    description: typeof r.description === 'string' || r.description === null ? (r.description as string | null) : null,
    category: typeof r.category === 'string' || r.category === null ? (r.category as string | null) : null,
  };
}

export async function fetchEpg(apiBase: string, channelId: string, signal?: AbortSignal): Promise<LiveEpg> {
  const base = apiBase.replace(/\/+$/, '');
  try {
    const res = await fetch(`${base}/api/v1/live/tv/epg/${encodeURIComponent(channelId)}?now=true&hours=6`, { signal });
    if (!res.ok) return { now: null, next: null, schedule: [] };
    const data = (await res.json().catch(() => null)) as { epg?: Record<string, unknown> } | null;
    const epg = data?.epg ?? {};
    const scheduleRaw = Array.isArray(epg.schedule) ? epg.schedule : [];
    const schedule: EpgProgramme[] = [];
    for (const entry of scheduleRaw) {
      const mapped = parseEpg(entry, channelId);
      if (mapped) schedule.push(mapped);
    }
    return {
      now: parseEpg(epg.now, channelId),
      next: parseEpg(epg.next, channelId),
      schedule,
    };
  } catch {
    return { now: null, next: null, schedule: [] };
  }
}

/** Returns true when the playhead is more than `threshold` seconds behind the live edge. */
export function isBehindLive(currentTime: number, liveEdgeStart: number | null, threshold = 10): boolean {
  if (liveEdgeStart === null || !Number.isFinite(liveEdgeStart)) return false;
  if (!Number.isFinite(currentTime)) return false;
  return liveEdgeStart - currentTime > threshold;
}

/** Seconds between the playhead and the live edge (negative when ahead). */
export function liveLatency(currentTime: number, liveEdgeStart: number | null): number | null {
  if (liveEdgeStart === null || !Number.isFinite(liveEdgeStart)) return null;
  if (!Number.isFinite(currentTime)) return null;
  return liveEdgeStart - currentTime;
}

export function formatLatency(seconds: number, locale: string): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'LIVE';
  const m = Math.round(seconds);
  if (m < 60) return `${m}s behind`;
  if (m < 3600) return `${Math.round(m / 60)}m behind`;
  return `${Math.round(m / 3600)}h behind`;
}
