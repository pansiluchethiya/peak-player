'use client';

import { createPlayer, liveFeature, videoFeatures } from '@videojs/react';
import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { fetchBranding, fetchStreamEvents } from '../../lib/api';
import { fetchMedia } from '../../lib/media';
import { getFingerprint } from '../../lib/fingerprint';
import { isPlayableSource, nextSourceIndex, sourceKey } from '../../lib/playback';
import { autoplayPolicy } from '../../lib/presentation';
import { connectionHint, isQualityCap, preferredSourceIndex } from '../../lib/quality';
import {
  DEFAULT_BRANDING,
  type Branding,
  type Diagnostic,
  type EmbedConfig,
  type Media,
  type MediaMetadata as ResolvedMediaMetadata,
  type Source,
  type StreamResponse,
  type Subtitle,
} from '../../lib/types';
import { PeakPlayerError, type PlayerErrorCode } from './errors';
import { t } from './i18n';
import { engineSource } from './media/source';
import type { EngineHandle, EngineSnapshot } from './media/useMediaEngine';
import {
  EMBED_CHANNEL,
  createEmbedEvent,
  createEmbedEventV2,
  isAllowedOrigin,
  parseEmbedRequest,
  type EmbedRequest,
} from '../../lib/embedBridge';
import {
  DEFAULT_PREFERENCES,
  MAX_BOOST,
  MAX_SPEED,
  MIN_SPEED,
  UNLOCKED_BOOST,
  migratePreferences,
  type AspectMode,
  type CaptionPreferences,
  type PlayerPreferences,
} from './prefs/schema';
import { resolvePreferenceMode, type PreferenceMode } from './prefs/modes';
import { providerForCodename, codenameForProvider } from '../../lib/servers';
import type { PlayerPreset } from './PlayerRoot';

/**
 * One store for every surface. Module scope is deliberate: `createPlayer` builds
 * a store factory, so calling it inside a component would create a new player
 * type on every render. `videoFeatures` has no live state, hence `liveFeature`.
 */
const { Player: EnginePlayer, usePlayer: useEnginePlayer } = createPlayer({
  features: [...videoFeatures, liveFeature],
});

export { EnginePlayer, useEnginePlayer };

export type PlayerStatus = 'loading' | 'ready' | 'error';

export interface MediaMetadata {
  title: string;
  year?: string | number;
  /** Runtime in minutes, populated by the media resolver in Task 8. */
  runtime?: number;
  /** Short synopsis for the poster overlay, populated in Task 8. */
  overview?: string;
  group?: string;
  logo?: string;
  /** Full resolver record from the `meta` SSE event. */
  media?: ResolvedMediaMetadata;
}

export interface PlayerState {
  status: PlayerStatus;
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  boost: number;
  speed: number;
  quality: 'auto' | string;
  audioTrack: string | null;
  captionsEnabled: boolean;
  fullscreen: boolean;
  pip: boolean;
  live: boolean;
  liveEdgeStart: number;
  targetLiveWindow: number;
  server: string | null;
  /** Index into the current source list. */
  sourceIndex: number;
  season: number | null;
  episode: number | null;
}

export interface PlayerApi {
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(seconds: number): Promise<void>;
  seekBy(delta: number): Promise<void>;
  setVolume(value: number): Promise<void>;
  setMuted(muted: boolean): Promise<void>;
  setBoost(value: number): Promise<void>;
  unlockBoost(unlocked: boolean): Promise<void>;
  setSpeed(value: number): Promise<void>;
  setQuality(level: 'auto' | string): Promise<void>;
  setAudioTrack(id: string): Promise<void>;
  setCaptions(options: Partial<CaptionPreferences>): Promise<void>;
  setColourPreset(preset: string): Promise<void>;
  setAspect(mode: AspectMode): Promise<void>;
  switchServer(codename: string): Promise<void>;
  switchSource(index: number): Promise<void>;
  nextEpisode(): Promise<void>;
  previousEpisode(): Promise<void>;
  goToLive(): Promise<void>;
  requestFullscreen(): Promise<void>;
  exitFullscreen(): Promise<void>;
  requestPictureInPicture(): Promise<void>;
  snapshot(): Promise<string>;
  getShareLink(): string;
  copyEmbedLink(): Promise<void>;
  getState(): PlayerState;
  getPreferences(): PlayerPreferences;
  setPreferences(patch: Partial<PlayerPreferences>): PlayerPreferences;
}

export interface PlayerContextValue {
  apiBase: string;
  media: Media;
  embed?: EmbedConfig;
  preset: PlayerPreset;
  status: PlayerStatus;
  error: string | null;
  errorCode: PlayerErrorCode | null;
  /** Autoplay rejected with NotAllowedError; the next gesture unmutes. */
  needsInteraction: boolean;
  payload: StreamResponse | null;
  mediaMetadata: MediaMetadata | null;
  branding: Branding;
  currentSourceIndex: number;
  sources: Source[];
  subtitles: Subtitle[];
  diagnostics: Diagnostic[];
  preferences: PlayerPreferences;
  /** Monotonic counter that forces the media surface to reload a source. */
  sourceNonce: number;
  setPreferences(patch: Partial<PlayerPreferences>): PlayerPreferences;
  registerEngine(handle: EngineHandle | null): void;
  setEngineStateReader(reader: (() => EngineSnapshot) | null): void;
  reload(invalidate?: boolean): void;
  tryNextSource(): void;
  useEnginePlayer: typeof useEnginePlayer;
  api: PlayerApi;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

const FIRST_SOURCE = 0;
const DISCOVERY_TIMEOUT_MS = 20_000;

function isAutoplayBlocked(reason: unknown): boolean {
  if (reason instanceof DOMException) return reason.name === 'NotAllowedError';
  return reason instanceof Error && reason.name === 'NotAllowedError';
}

/** Maps a v2 SDK command to the corresponding PlayerApi call (spec §12.1). */
function dispatchCommand(command: string, value: unknown, playerApi: PlayerApi): unknown {
  switch (command) {
    case 'play': return playerApi.play();
    case 'pause': return playerApi.pause();
    case 'seek': return playerApi.seek(Number(value));
    case 'seekBy': return playerApi.seekBy(Number(value));
    case 'setVolume': return playerApi.setVolume(Number(value));
    case 'setMuted': return playerApi.setMuted(Boolean(value));
    case 'setBoost': return playerApi.setBoost(Number(value));
    case 'unlockBoost': return playerApi.unlockBoost(Boolean(value));
    case 'setSpeed': return playerApi.setSpeed(Number(value));
    case 'setQuality': return playerApi.setQuality(String(value));
    case 'setAudioTrack': return playerApi.setAudioTrack(String(value));
    case 'setCaptions': return playerApi.setCaptions(value as Record<string, unknown>);
    case 'setColourPreset': return playerApi.setColourPreset(String(value));
    case 'setAspect': return playerApi.setAspect(String(value) as 'fit' | 'fill' | 'zoom');
    case 'switchServer': return playerApi.switchServer(String(value));
    case 'nextEpisode': return playerApi.nextEpisode();
    case 'previousEpisode': return playerApi.previousEpisode();
    case 'goToLive': return playerApi.goToLive();
    case 'requestFullscreen': return playerApi.requestFullscreen();
    case 'exitFullscreen': return playerApi.exitFullscreen();
    case 'requestPictureInPicture': return playerApi.requestPictureInPicture();
    case 'snapshot': return playerApi.snapshot();
    case 'getShareLink': return playerApi.getShareLink();
    case 'copyEmbedLink': return playerApi.copyEmbedLink();
    case 'getState': return playerApi.getState();
    case 'getPreferences': return playerApi.getPreferences();
    case 'setPreferences': return playerApi.setPreferences(value as Partial<PlayerPreferences>);
    default: throw new PeakPlayerError('UNSUPPORTED', `Unknown command: ${command}`);
  }
}

function initialSourceIndex(sources: Source[]): number {
  if (sources.length === 0) return FIRST_SOURCE;
  const preferred = preferredSourceIndex(sources, connectionHint());
  if (isPlayableSource(sources[preferred])) return preferred;
  const playable = sources.findIndex(isPlayableSource);
  return playable >= 0 ? playable : FIRST_SOURCE;
}

interface PlayerProviderProps {
  apiBase: string;
  media: Media;
  embed?: EmbedConfig;
  preset?: PlayerPreset;
  children: ReactNode;
}

export function PlayerProvider({
  apiBase,
  media,
  embed,
  preset = 'video',
  children,
}: PlayerProviderProps) {
  const router = useRouter();

  const [status, setStatus] = useState<PlayerStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<PlayerErrorCode | null>(null);
  const [needsInteraction, setNeedsInteraction] = useState(false);
  const [mutedPlayback, setMutedPlayback] = useState(false);
  const [mediaMetadata, setMediaMetadata] = useState<MediaMetadata | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [currentSourceIndex, setCurrentSourceIndex] = useState(FIRST_SOURCE);
  const [sourceNonce, setSourceNonce] = useState(0);
  const [branding, setBranding] = useState<Branding>(DEFAULT_BRANDING);
  const [request, setRequest] = useState({ token: 0, invalidate: false });

  const preferencesRef = useRef<PlayerPreferences>(
    migratePreferences((embed?.preferences as Record<string, unknown>) ?? DEFAULT_PREFERENCES),
  );
  const [preferences, setPreferencesState] = useState<PlayerPreferences>(
    migratePreferences((embed && embed.preferences) ?? DEFAULT_PREFERENCES),
  );

  const engineHandleRef = useRef<EngineHandle | null>(null);
  const engineStateReaderRef = useRef<(() => EngineSnapshot) | null>(null);
  const autoplayTokenRef = useRef<string | null>(null);
  const timestampSeekRef = useRef<string | null>(null);
  const terminalRef = useRef(false);
  const closeDiscoveryRef = useRef<(() => void) | null>(null);
  /** Discovery finished, so "no source left" is a real terminal state. */
  const discoveryDoneRef = useRef(false);
  /** A source failed while providers were still streaming; wait for more. */
  const pendingFailoverRef = useRef(false);
  const [engineGeneration, setEngineGeneration] = useState(0);

  const embedRef = useRef(embed);
  embedRef.current = embed;

  const latestRef = useRef({ status, sources, currentSourceIndex, mediaMetadata });
  latestRef.current = { status, sources, currentSourceIndex, mediaMetadata };

  const payload = useMemo<StreamResponse | null>(() => {
    if (!mediaMetadata && sources.length === 0 && subtitles.length === 0 && diagnostics.length === 0) {
      return null;
    }
    return {
      id: media.id,
      type: media.type,
      title: mediaMetadata?.title ?? '',
      year: mediaMetadata?.year,
      sources,
      subtitles,
      media: mediaMetadata?.media,
      meta: { latencyMs: 0, providers: diagnostics.length, sources: sources.length },
      diagnostics,
      group: mediaMetadata?.group,
      logo: mediaMetadata?.logo,
    };
  }, [diagnostics, media.id, media.type, mediaMetadata, sources, subtitles]);

  const mergePreferences = useCallback((patch: Partial<PlayerPreferences>): PlayerPreferences => {
    const current = preferencesRef.current;
    const next: PlayerPreferences = {
      ...current,
      ...patch,
      captions: patch.captions ? { ...current.captions, ...patch.captions } : current.captions,
    };
    preferencesRef.current = next;
    setPreferencesState(next);
    return next;
  }, []);

  const registerEngine = useCallback((handle: EngineHandle | null) => {
    engineHandleRef.current = handle;
    setEngineGeneration((value) => value + 1);
  }, []);

  const setEngineStateReader = useCallback((reader: (() => EngineSnapshot) | null) => {
    engineStateReaderRef.current = reader;
  }, []);

  /**
   * Terminal failures never recover on their own: the SSE connection is closed
   * and late source events are ignored until `reload()` or a new request.
   */
  const failTerminal = useCallback((message: string, code: PlayerErrorCode = 'STREAM_UNAVAILABLE') => {
    terminalRef.current = true;
    discoveryDoneRef.current = true;
    pendingFailoverRef.current = false;
    closeDiscoveryRef.current?.();
    closeDiscoveryRef.current = null;
    setStatus('error');
    setErrorCode(code);
    setError(message);
  }, []);

  // --- Branding ---
  useEffect(() => {
    const controller = new AbortController();
    fetchBranding(apiBase, controller.signal).then(setBranding).catch(() => undefined);
    return () => controller.abort();
  }, [apiBase]);

  // --- SSE discovery ---
  useEffect(() => {
    let eventSource: { close: () => void } | null = null;
    let cancelled = false;

    terminalRef.current = false;
    discoveryDoneRef.current = false;
    pendingFailoverRef.current = false;
    closeDiscoveryRef.current = null;
    autoplayTokenRef.current = null;

    const accumulated: {
      metadata: MediaMetadata | null;
      sources: Source[];
      subtitles: Subtitle[];
      diagnostics: Diagnostic[];
    } = { metadata: null, sources: [], subtitles: [], diagnostics: [] };
    let resolvedMetadata: ResolvedMediaMetadata | null = null;

    /**
     * The SSE `meta` event is deliberately lean and omits the synopsis, so the
     * resolver record is fetched in parallel and merged underneath it. Stream
     * fields always win; the resolver only fills the gaps it knows about.
     */
    const mergedMetadata = (): MediaMetadata | null => {
      const streamed = accumulated.metadata;
      const resolved = resolvedMetadata;
      if (!streamed && !resolved) return null;
      return {
        title: streamed?.title?.trim() ? streamed.title : resolved?.title ?? '',
        year: streamed?.year ?? resolved?.year ?? undefined,
        runtime: streamed?.runtime ?? resolved?.runtime ?? undefined,
        overview: streamed?.overview?.trim() ? streamed.overview : resolved?.overview ?? undefined,
        group: streamed?.group ?? undefined,
        logo: streamed?.logo ?? undefined,
        media: streamed?.media ?? resolved ?? undefined,
      };
    };

    setStatus('loading');
    setError(null);
    setErrorCode(null);
    setNeedsInteraction(false);
    setMutedPlayback(false);
    setMediaMetadata(null);
    setSources([]);
    setSubtitles([]);
    setDiagnostics([]);
    setCurrentSourceIndex(FIRST_SOURCE);
    setSourceNonce(0);

    const publish = () => {
      if (cancelled || terminalRef.current) return;
      const metadata = mergedMetadata();
      if (metadata) setMediaMetadata(metadata);
      setSources([...accumulated.sources]);
      setSubtitles([...accumulated.subtitles]);
      setDiagnostics([...accumulated.diagnostics]);
    };

    fetchMedia(apiBase, media)
      .then((data) => {
        if (cancelled) return;
        resolvedMetadata = data;
        publish();
      })
      .catch(() => undefined);

    const handleMeta = (data: {
      title: string;
      year?: string | number;
      runtime?: number;
      overview?: string;
      group?: string;
      logo?: string;
      media?: ResolvedMediaMetadata;
    }) => {
      if (cancelled || terminalRef.current) return;
      accumulated.metadata = {
        title: data.title ?? '',
        year: data.year,
        runtime: data.runtime,
        overview: data.overview,
        group: data.group,
        logo: data.logo,
        media: data.media,
      };
      publish();
    };

    const lastPlayableIndex = () => {
      for (let index = accumulated.sources.length - 1; index >= 0; index -= 1) {
        if (isPlayableSource(accumulated.sources[index])) return index;
      }
      return -1;
    };

    const handleSource = (source: Source) => {
      if (cancelled || terminalRef.current) return;
      const first = accumulated.sources.length === 0;
      accumulated.sources.push(source);
      publish();
      if (first) {
        setCurrentSourceIndex(initialSourceIndex(accumulated.sources));
        setError(null);
        setErrorCode(null);
        setStatus('ready');
        return;
      }
      // Every earlier source failed while providers were still streaming; the
      // next playable one that arrives takes over without surfacing an error.
      if (pendingFailoverRef.current) {
        const index = lastPlayableIndex();
        if (index < 0) return;
        pendingFailoverRef.current = false;
        terminalRef.current = false;
        setError(null);
        setErrorCode(null);
        setStatus('ready');
        setCurrentSourceIndex(index);
        setSourceNonce((value) => value + 1);
      }
    };

    const handleSubtitle = (subtitle: Subtitle) => {
      if (cancelled || terminalRef.current) return;
      accumulated.subtitles.push(subtitle);
      publish();
    };

    const handleDiagnostic = (diagnostic: Diagnostic) => {
      if (cancelled || terminalRef.current) return;
      accumulated.diagnostics.push(diagnostic);
      publish();
    };

    const handleDone = () => {
      if (cancelled || terminalRef.current) return;
      discoveryDoneRef.current = true;
      publish();
      if (accumulated.sources.length === 0) {
        failTerminal(t('title-not-found'));
        return;
      }
      if (pendingFailoverRef.current) {
        pendingFailoverRef.current = false;
        const index = lastPlayableIndex();
        if (index < 0) {
          failTerminal(t('title-not-found'));
          return;
        }
        terminalRef.current = false;
        setError(null);
        setErrorCode(null);
        setStatus('ready');
        setCurrentSourceIndex(index);
        setSourceNonce((value) => value + 1);
        return;
      }
      setCurrentSourceIndex((current) =>
        isPlayableSource(accumulated.sources[current]) ? current : initialSourceIndex(accumulated.sources),
      );
    };

    const handleError = () => {
      if (cancelled || terminalRef.current) return;
      // A transport error can arrive after usable sources have already been
      // published (providers time out progressively). Marking the player
      // terminal at that point replaces a playing stream with an error overlay,
      // so keep whatever is already playable.
      if (accumulated.sources.length > 0) return;
      discoveryDoneRef.current = true;
      failTerminal(t('title-not-found'));
    };

    (async () => {
      try {
        const fingerprint = await getFingerprint();
        if (cancelled) return;
        eventSource = fetchStreamEvents(apiBase, media, fingerprint, {
          invalidate: request.invalidate,
          embed: Boolean(embedRef.current),
          onMeta: handleMeta,
          onSource: handleSource,
          onSubtitle: handleSubtitle,
          onDiagnostic: handleDiagnostic,
          onDone: handleDone,
          onError: handleError,
        });
        // The deadline can fire while the fingerprint/EventSource is in flight.
        // Close the late connection instead of leaving a terminal SSE leak.
        if (cancelled || terminalRef.current) {
          eventSource.close();
          return;
        }
        closeDiscoveryRef.current = () => eventSource?.close();
      } catch (reason) {
        if (cancelled) return;
        failTerminal(reason instanceof Error ? reason.message : t('stream-failed'));
      }
    })();

    return () => {
      cancelled = true;
      closeDiscoveryRef.current = null;
      eventSource?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, embed, media.type, media.id, media.season, media.episode, request]);

  // --- Document title ---
  // Next re-applies the route metadata title after the provider publishes new
  // state, so a one-shot effect loses the media title on later navigations.
  // Observe the head and reassert the media title whenever Next rewrites it.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const title = mediaMetadata?.title?.trim();
    const desired = !title
      ? branding.name
      : (() => {
          const withYear = mediaMetadata?.year ? `${title} (${mediaMetadata.year})` : title;
          return withYear === branding.name ? withYear : `${withYear} — ${branding.name}`;
        })();
    if (!desired) return;
    const apply = () => {
      if (document.title !== desired) document.title = desired;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [branding.name, mediaMetadata]);

  // --- Apply stored preferences when an engine attaches ---
  useEffect(() => {
    const handle = engineHandleRef.current;
    if (!handle) return;
    try {
      handle.setVolume(preferencesRef.current.volume);
      // Autoplay always starts muted; the tap-to-unmute chip is the only way a
      // stored `muted: false` becomes audible without a user gesture.
      handle.setMuted(autoplayPolicy(preferencesRef.current).muted);
      handle.setSpeed(preferencesRef.current.speed);
    } catch {
      // The handle registers before a media element exists. `registerEngine`
      // runs again when the element attaches, so the next pass applies these.
    }
  }, [engineGeneration, preset]);

  // --- Terminal discovery deadline (spec §14: never an infinite spinner) ---
  useEffect(() => {
    if (status !== 'loading') return;
    const timer = window.setTimeout(() => {
      failTerminal(t('stream-unavailable'));
    }, DISCOVERY_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [failTerminal, request, status]);

  const reload = useCallback((invalidate = false) => {
    terminalRef.current = false;
    discoveryDoneRef.current = false;
    pendingFailoverRef.current = false;
    autoplayTokenRef.current = null;
    setStatus('loading');
    setError(null);
    setErrorCode(null);
    setNeedsInteraction(false);
    setMutedPlayback(false);
    setSources([]);
    setSubtitles([]);
    setDiagnostics([]);
    setMediaMetadata(null);
    setCurrentSourceIndex(FIRST_SOURCE);
    setSourceNonce((value) => value + 1);
    setRequest((previous) => ({ token: previous.token + 1, invalidate }));
  }, []);

  const tryNextSource = useCallback(() => {
    const current = latestRef.current;
    const attempted = new Set<string>();
    for (let index = 0; index <= current.currentSourceIndex; index += 1) {
      attempted.add(sourceKey(current.sources[index], index));
    }
    const next = nextSourceIndex(current.sources, current.currentSourceIndex, attempted);
    if (next < 0) {
      // Providers may still be streaming. Wait for the next source instead of
      // reporting a failure; only a finished discovery is a real dead end.
      if (!discoveryDoneRef.current) {
        pendingFailoverRef.current = true;
        setStatus('loading');
        setError(null);
        setErrorCode(null);
        return;
      }
      failTerminal(t('title-not-found'));
      return;
    }
    pendingFailoverRef.current = false;
    // A new source restarts playback, so late SSE events may publish again.
    terminalRef.current = false;
    setError(null);
    setErrorCode(null);
    setStatus('ready');
    setCurrentSourceIndex(next);
    setSourceNonce((value) => value + 1);
  }, [failTerminal]);

  const requireEngine = useCallback(async (): Promise<EngineHandle> => {
    const handle = engineHandleRef.current;
    if (!handle) throw new PeakPlayerError('NOT_READY', t('player-not-ready'));
    return handle;
  }, []);

  const api = useMemo<PlayerApi>(() => {
    const applyPreferences = (patch: Partial<PlayerPreferences>) => {
      const next = mergePreferences(patch);
      const handle = engineHandleRef.current;
      if (handle) {
        if (patch.volume !== undefined) handle.setVolume(next.volume);
        if (patch.muted !== undefined) handle.setMuted(next.muted);
        if (patch.speed !== undefined) handle.setSpeed(next.speed);
        if (patch.captions !== undefined) handle.setCaptions(next.captions);
        if (patch.audioTrack) handle.setAudioTrack(patch.audioTrack);
      }
      return next;
    };

    return {
      play: async () => {
        const handle = await requireEngine();
        await handle.play();
      },
      pause: async () => {
        const handle = await requireEngine();
        handle.pause();
      },
      seek: async (seconds: number) => {
        if (!Number.isFinite(seconds) || seconds < 0) {
          throw new PeakPlayerError('INVALID_ARGUMENT', t('invalid-seek'));
        }
        const handle = await requireEngine();
        await handle.seek(seconds);
      },
      seekBy: async (delta: number) => {
        if (!Number.isFinite(delta)) {
          throw new PeakPlayerError('INVALID_ARGUMENT', t('invalid-seek-delta'));
        }
        const handle = await requireEngine();
        const state = engineStateReaderRef.current?.();
        const current = state?.currentTime ?? 0;
        const upper = state?.duration && Number.isFinite(state.duration) ? state.duration : Number.MAX_SAFE_INTEGER;
        await handle.seek(Math.min(Math.max(current + delta, 0), upper));
      },
      setVolume: async (value: number) => {
        if (!Number.isFinite(value) || value < 0 || value > 1) {
          throw new PeakPlayerError('INVALID_ARGUMENT', t('volume-range'));
        }
        const handle = await requireEngine();
        handle.setVolume(value);
        mergePreferences({ volume: value });
      },
      setMuted: async (muted: boolean) => {
        const handle = await requireEngine();
        handle.setMuted(muted);
        mergePreferences({ muted });
      },
      setBoost: async (value: number) => {
        if (!Number.isFinite(value) || value < 0 || value > MAX_BOOST) {
          throw new PeakPlayerError('INVALID_ARGUMENT', t('boost-range'));
        }
        if (value > UNLOCKED_BOOST && !preferencesRef.current.boostUnlocked) {
          throw new PeakPlayerError('PERMISSION_DENIED', t('boost-locked'));
        }
        const handle = await requireEngine();
        handle.setBoost(value, preferencesRef.current.boostUnlocked);
        mergePreferences({ boost: value });
      },
      unlockBoost: async (unlocked: boolean) => {
        const handle = await requireEngine();
        handle.setBoost(preferencesRef.current.boost, unlocked);
        mergePreferences({ boostUnlocked: unlocked });
      },
      setSpeed: async (value: number) => {
        if (!Number.isFinite(value) || value < MIN_SPEED || value > MAX_SPEED) {
          throw new PeakPlayerError('INVALID_ARGUMENT', t('speed-range'));
        }
        const handle = await requireEngine();
        handle.setSpeed(value);
        mergePreferences({ speed: value });
      },
      setQuality: async (level: 'auto' | string) => {
        if (!isQualityCap(level)) throw new PeakPlayerError('INVALID_ARGUMENT', t('quality-unavailable'));
        // The cap is a preference, not a fixed rendition: ABR stays adaptive
        // underneath it, and MediaSurface forwards the ceiling to hls.js.
        mergePreferences({ quality: level });
      },
      setAudioTrack: async (id: string) => {
        if (!id) throw new PeakPlayerError('INVALID_ARGUMENT', t('track-unavailable'));
        const handle = await requireEngine();
        handle.setAudioTrack(id);
        mergePreferences({ audioTrack: id });
      },
      setCaptions: async (options: Partial<CaptionPreferences>) => {
        const handle = await requireEngine();
        handle.setCaptions(options);
        mergePreferences({ captions: { ...preferencesRef.current.captions, ...options } });
      },
      setColourPreset: async (colourPreset: string) => {
        if (!colourPreset) throw new PeakPlayerError('INVALID_ARGUMENT', t('colour-required'));
        mergePreferences({ colourPreset });
      },
      setAspect: async (mode: AspectMode) => {
        if (mode !== 'fit' && mode !== 'fill' && mode !== 'zoom') {
          throw new PeakPlayerError('INVALID_ARGUMENT', t('aspect-invalid'));
        }
        mergePreferences({ aspect: mode });
      },
      switchServer: async (codename: string) => {
        // Resolve the codename to a provider id (case-insensitive). Fall back
        // to a direct provider match for callers that pass the raw provider.
        const resolved = providerForCodename(codename) ?? codename;
        const needle = resolved.toLowerCase();
        const index = latestRef.current.sources.findIndex(
          (source) => source.provider.toLowerCase() === needle,
        );
        if (index < 0) throw new PeakPlayerError('INVALID_ARGUMENT', t('unknown-server'));
        terminalRef.current = false;
        setError(null);
        setErrorCode(null);
        setStatus('ready');
        setCurrentSourceIndex(index);
        mergePreferences({ server: latestRef.current.sources[index]?.provider ?? codename });
        setSourceNonce((value) => value + 1);
      },
      switchSource: async (index: number) => {
        const source = latestRef.current.sources[index];
        if (!source) throw new PeakPlayerError('INVALID_ARGUMENT', t('unknown-server'));
        terminalRef.current = false;
        setError(null);
        setErrorCode(null);
        setStatus('ready');
        setCurrentSourceIndex(index);
        mergePreferences({ server: source.provider });
        setSourceNonce((value) => value + 1);
      },
      nextEpisode: async () => {
        if (media.type !== 'tv') throw new PeakPlayerError('UNSUPPORTED', t('no-episodes'));
        const season = media.season ?? 1;
        const episode = (media.episode ?? 1) + 1;
        const prefix = embed ? '/embed/tv' : '/tv';
        router.push(`${prefix}/${encodeURIComponent(media.id)}/${season}/${episode}`);
      },
      previousEpisode: async () => {
        if (media.type !== 'tv') throw new PeakPlayerError('UNSUPPORTED', t('no-episodes'));
        const season = media.season ?? 1;
        const episode = Math.max(1, (media.episode ?? 1) - 1);
        const prefix = embed ? '/embed/tv' : '/tv';
        router.push(`${prefix}/${encodeURIComponent(media.id)}/${season}/${episode}`);
      },
      goToLive: async () => {
        const handle = await requireEngine();
        await handle.seekToLive(0);
      },
      requestFullscreen: async () => {
        await requireEngine();
        if (typeof document === 'undefined') return;
        // Fullscreen the Peak shell, not the media element, so the custom
        // transport and settings chrome stay visible in fullscreen.
        const target = document.querySelector<HTMLElement>('.player-root') ?? document.documentElement;
        await target.requestFullscreen();
      },
      exitFullscreen: async () => {
        if (typeof document !== 'undefined' && document.fullscreenElement) {
          await document.exitFullscreen();
        }
      },
      requestPictureInPicture: async () => {
        const handle = await requireEngine();
        await handle.requestPictureInPicture();
      },
      snapshot: async () => {
        const handle = await requireEngine();
        return handle.snapshot();
      },
      getShareLink: () => {
        if (typeof window === 'undefined') return '';
        return window.location.href;
      },
      copyEmbedLink: async () => {
        if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
          throw new PeakPlayerError('UNSUPPORTED', t('clipboard-unavailable'));
        }
        const origin = typeof window === 'undefined' ? '' : window.location.origin;
        const token = typeof window === 'undefined' ? null : new URL(window.location.href).searchParams.get('token');
        const path =
          media.type === 'tv'
            ? `/embed/tv/${encodeURIComponent(media.id)}/${media.season ?? 1}/${media.episode ?? 1}`
            : media.type === 'live_tv'
              ? `/embed/live/${encodeURIComponent(media.id)}`
              : `/embed/movie/${encodeURIComponent(media.id)}`;
        await navigator.clipboard.writeText(
          token ? `${origin}${path}?token=${encodeURIComponent(token)}` : `${origin}${path}`,
        );
      },
      getState: () => {
        const engine = engineStateReaderRef.current?.();
        const current = latestRef.current;
        const prefs = preferencesRef.current;
        return {
          status: current.status,
          playing: engine?.playing ?? false,
          currentTime: engine?.currentTime ?? 0,
          duration: engine?.duration ?? 0,
          volume: engine?.volume ?? prefs.volume,
          muted: engine?.muted ?? prefs.muted,
          boost: prefs.boost,
          speed: engine?.speed ?? prefs.speed,
          quality: engine?.quality ?? prefs.quality,
          audioTrack: engine?.audioTrack ?? prefs.audioTrack,
          captionsEnabled: engine?.captionsEnabled ?? prefs.captions.enabled,
          fullscreen:
            typeof document !== 'undefined'
              ? Boolean(document.fullscreenElement)
              : engine?.fullscreen ?? false,
          pip: engine?.pip ?? false,
          live: engine?.live ?? media.type === 'live_tv',
          liveEdgeStart: engine?.liveEdgeStart ?? Number.NaN,
          targetLiveWindow: engine?.targetLiveWindow ?? Number.NaN,
          server: current.sources[current.currentSourceIndex]?.provider ?? null,
          sourceIndex: current.currentSourceIndex,
          season: media.type === 'tv' ? media.season ?? 1 : null,
          episode: media.type === 'tv' ? media.episode ?? 1 : null,
        };
      },
      getPreferences: () => {
        const current = preferencesRef.current;
        return { ...current, captions: { ...current.captions } };
      },
      setPreferences: (patch: Partial<PlayerPreferences>) => applyPreferences(patch),
    };
  }, [media, embed, mergePreferences, requireEngine, router]);

  // --- Muted autoplay (spec §10) ---
  useEffect(() => {
    if (status !== 'ready' || engineGeneration === 0) return;
    const token = `${currentSourceIndex}:${sourceNonce}:${engineGeneration}`;
    if (autoplayTokenRef.current === token) return;

    const policy =
      preset === 'bg'
        ? { shouldPlay: true, muted: true }
        : autoplayPolicy(preferencesRef.current);
    if (!policy.shouldPlay) return;

    autoplayTokenRef.current = token;
    let cancelled = false;

    (async () => {
      try {
        await api.setMuted(policy.muted);
        await api.play();
        if (!cancelled) {
          const current = latestRef.current;
          const source = current.sources[current.currentSourceIndex];
          const external = source ? engineSource(source, media).kind === 'external' : false;
          setNeedsInteraction(false);
          setMutedPlayback(policy.muted && preset !== 'bg' && !external);
        }
      } catch (reason) {
        if (!cancelled) {
          setMutedPlayback(false);
          if (isAutoplayBlocked(reason)) setNeedsInteraction(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [api, currentSourceIndex, engineGeneration, media, preset, sourceNonce, status]);

  // --- Timestamp deep links (`?t=123` or `?t=1m30s` style) ---
  useEffect(() => {
    if (status !== 'ready' || typeof window === 'undefined') return;
    const key = `${media.type}:${media.id}:${media.season ?? ''}:${media.episode ?? ''}`;
    if (timestampSeekRef.current === key) return;

    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const raw = search.get('t') ?? hash.get('t');
    if (!raw) return;

    // Accept plain seconds plus `90s`, `1m30s`, and `1h2m3s` forms.
    let seconds = 0;
    if (/^\d+(\.\d+)?$/.test(raw)) {
      seconds = Number.parseFloat(raw);
    } else {
      const match = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?$/i);
      if (!match) return;
      seconds = Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
    }
    if (!Number.isFinite(seconds) || seconds <= 0) return;

    timestampSeekRef.current = key;
    // `status === 'ready'` can precede the engine handle attach, so a seek may
    // reject with NOT_READY. Retry briefly instead of dropping the deep link.
    let attempts = 0;
    const attempt = () => {
      if (timestampSeekRef.current !== key) return;
      api.seek(seconds).catch(() => {
        if (timestampSeekRef.current !== key || attempts >= 24) return;
        attempts += 1;
        window.setTimeout(attempt, 250);
      });
    };
    attempt();
  }, [api, media.episode, media.id, media.season, media.type, status]);

  // --- First pointer/key gesture unmutes a successful muted autoplay once ---
  useEffect(() => {
    if (!mutedPlayback) return;
    const handler = () => {
      setMutedPlayback(false);
      api.setMuted(false).catch(() => undefined);
    };
    window.addEventListener('pointerdown', handler, { once: true });
    window.addEventListener('keydown', handler, { once: true });
    return () => {
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handler);
    };
  }, [api, mutedPlayback]);

  // --- First pointer/key gesture unmutes once after an autoplay rejection ---
  useEffect(() => {
    if (!needsInteraction) return;
    const handler = () => {
      setNeedsInteraction(false);
      api
        .setMuted(false)
        .then(() => api.play())
        .catch(() => undefined);
    };
    window.addEventListener('pointerdown', handler, { once: true });
    window.addEventListener('keydown', handler, { once: true });
    return () => {
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handler);
    };
  }, [api, needsInteraction]);

  // --- SDK v2 postMessage request bridge (spec §12.1) ---
  // Receives typed requests from the parent frame, dispatches them through the
  // PlayerApi, and responds with ok/result or a typed error envelope.
  useEffect(() => {
    const allowedOrigins = embed?.origins ?? [];
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin === 'null' || !isAllowedOrigin(event.origin, allowedOrigins)) return;
      const request = parseEmbedRequest(event.data);
      if (!request) return;

      const { command, value, id } = request;

      const sendResponse = (response: { ok: boolean; result?: unknown; error?: { code: string; message: string } }) => {
        if (event.source && typeof event.source.postMessage === 'function') {
          event.source.postMessage(
            { channel: EMBED_CHANNEL, type: 'response', id, ...response },
            { targetOrigin: event.origin } as unknown as WindowPostMessageOptions,
          );
        }
      };

      try {
        const result = await dispatchCommand(command, value, api);
        sendResponse({ ok: true, result });
      } catch (error) {
        const code = error instanceof PeakPlayerError ? error.code : 'UNKNOWN';
        sendResponse({ ok: false, error: { code, message: error instanceof Error ? error.message : String(error) } });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [embed?.origins, api]);

  const contextValue = useMemo<PlayerContextValue>(
    () => ({
      apiBase,
      media,
      embed,
      preset,
      status,
      error,
      errorCode,
      needsInteraction,
      payload,
      mediaMetadata,
      branding,
      currentSourceIndex,
      sources,
      subtitles,
      diagnostics,
      preferences,
      sourceNonce,
      setPreferences: mergePreferences,
      registerEngine,
      setEngineStateReader,
      reload,
      tryNextSource,
      useEnginePlayer,
      api,
    }),
    [
      api,
      apiBase,
      branding,
      currentSourceIndex,
      diagnostics,
      embed,
      error,
      errorCode,
      media,
      mediaMetadata,
      mergePreferences,
      needsInteraction,
      payload,
      preferences,
      preset,
      registerEngine,
      reload,
      setEngineStateReader,
      sourceNonce,
      sources,
      status,
      subtitles,
      tryNextSource,
    ],
  );

  return <PlayerContext.Provider value={contextValue}>{children}</PlayerContext.Provider>;
}

export function usePlayerContext(): PlayerContextValue {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayerContext must be used inside a PlayerProvider.');
  }
  return context;
}

export function usePlayerApi(): PlayerApi {
  return usePlayerContext().api;
}
