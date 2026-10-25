'use client';

import Hls from 'hls.js';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { fetchBranding, fetchStreamEvents } from '../lib/api';
import { getFingerprint } from '../lib/fingerprint';
import {
  autoQualityCap,
  capLevelIndex,
  connectionHint,
  initialBandwidthEstimate,
  levelLabel,
  preferredSourceIndex,
  sortLevelsDescending,
  type HlsLevelLike,
} from '../lib/quality';
import {
  createEmbedEvent,
  isAllowedOrigin,
  parseEmbedCommand,
  postToParent,
  type EmbedEventName,
} from '../lib/embedBridge';
import { isPlayableSource, nextSourceIndex, sourceKey } from '../lib/playback';
import { calculateBufferedRanges, clamp, type BufferedRange } from '../lib/time';
import {
  DEFAULT_BRANDING,
  type Branding,
  type Diagnostic,
  type EmbedConfig,
  type Media,
  type Source,
  type StreamResponse,
  type Subtitle,
} from '../lib/types';
import { AmbientBackground } from './AmbientBackground';
import { CenterFeedback } from './CenterFeedback';
import { ControlBar, type QualityOption } from './ControlBar';
import { ErrorState } from './ErrorState';
import { ExternalEmbed } from './ExternalEmbed';
import { LoadingSkeleton } from './LoadingSkeleton';
import { MobileGestureLayer } from './MobileGestureLayer';
import { MobilePlayerControls } from './MobilePlayerControls';
import { PlayerHeader } from './PlayerHeader';
import { SkipFeedback } from './SkipFeedback';

interface Props {
  apiBase: string;
  media: Media;
  embed?: EmbedConfig;
}

type Status = 'loading' | 'ready' | 'error';

const FIRST_PLAYABLE_TIMEOUT_MS = 1500;
const EMBED_TIMEUPDATE_INTERVAL_MS = 250;

interface LevelOption extends HlsLevelLike {
  index: number;
}

/**
 * VideoJsEmbedPlayer — Video.js-based player with hls.js fallback.
 *
 * Strategy: Video.js is the primary media engine. The player:
 *   1. Attempts to initialize Video.js with VHS HLS support.
 *   2. If Video.js fails, falls back to hls.js directly.
 *   3. If hls.js is unsupported, uses native HTML5 video.
 *
 * Maintains the same embed-bridge contract and AMOLED styling as Player.tsx.
 */
export function VideoJsEmbedPlayer({ apiBase, media, embed }: Props) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null); // Video.js player instance
  const hlsRef = useRef<Hls | null>(null);
  const pendingSeekRef = useRef<number | null>(null);
  const embedRef = useRef(embed);
  embedRef.current = embed;
  const parentOriginRef = useRef('');
  const embedReadyRef = useRef(false);
  const wasPlayingRef = useRef(false);
  const lastTimeUpdateRef = useRef(0);

  const [branding, setBranding] = useState<Branding>(DEFAULT_BRANDING);
  const [payload, setPayload] = useState<StreamResponse | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState({ token: 0, invalidate: false });

  const [sourceIndex, setSourceIndex] = useState(0);
  const [sourceNonce, setSourceNonce] = useState(0);
  const [reloadCount, setReloadCount] = useState(0);
  const [switching, setSwitching] = useState<{ from: number; to: number; servers: string[] } | null>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedRanges, setBufferedRanges] = useState<BufferedRange[]>([]);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [needsInteraction, setNeedsInteraction] = useState(false);
  const [subtitleIndex, setSubtitleIndex] = useState(-1);
  const [nextCountdown, setNextCountdown] = useState<number | null>(null);
  const [pipSupported, setPipSupported] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [hlsLevels, setHlsLevels] = useState<LevelOption[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [currentAutoLevel, setCurrentAutoLevel] = useState<number | null>(null);

  // --- Refs ---
  const accumulatedRef = useRef<{
    title: string;
    year?: string | number;
    group?: string;
    logo?: string;
    sources: Source[];
    subtitles: Subtitle[];
    diagnostics: Diagnostic[];
    done: boolean;
  }>({ title: 'Peak', sources: [], subtitles: [], diagnostics: [], done: false });
  const firstSourceTsRef = useRef<number | null>(null);
  const selectedIndexRef = useRef(0);
  const attemptedSourcesRef = useRef<Set<string>>(new Set());
  const tryAnotherSourceRef = useRef<() => void>(() => {});
  const switchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Inactivity / Auto-hide controls state
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Center & Skip Feedback state
  const [centerFeedback, setCenterFeedback] = useState<{ action: 'play' | 'pause' | null; nonce: number }>({
    action: null,
    nonce: 0,
  });
  const [skipFeedback, setSkipFeedback] = useState<{ direction: 'backward' | 'forward' | null; seconds: number; nonce: number }>({
    direction: null,
    seconds: 0,
    nonce: 0,
  });
  const skipFeedbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const skipFeedbackStateRef = useRef<{ direction: 'backward' | 'forward' | null; seconds: number; time: number }>({
    direction: null,
    seconds: 0,
    time: 0,
  });

  const speedRef = useRef(speed);
  speedRef.current = speed;

  const source = payload?.sources[sourceIndex];
  const isEmbedSource = source?.codec === 'html5';
  const embedOriginsKey = embed?.origins.join('|') ?? '';
  const sourceDescriptor = source
    ? JSON.stringify([sourceIndex, source.quality, source.provider, source.codec])
    : '';

  const sendEmbedEvent = useCallback((event: EmbedEventName, data?: Record<string, unknown>) => {
    if (!embedRef.current) return;
    const origin = parentOriginRef.current;
    if (!origin) return;
    postToParent(window.parent, origin, createEmbedEvent(event, data));
  }, []);

  // --- Embed parent origin resolution ---
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const configured = embedRef.current?.origins?.[0];
    const ancestor =
      window.location.ancestorOrigins && window.location.ancestorOrigins.length > 0
        ? (window.location.ancestorOrigins as DOMStringList)[0]
        : '';
    const candidate = configured || ancestor;
    try {
      parentOriginRef.current = candidate ? new URL(candidate).origin : '';
    } catch {
      parentOriginRef.current = '';
    }
    embedReadyRef.current = false;
  }, [embedOriginsKey]);

  // --- Branding ---
  useEffect(() => {
    const controller = new AbortController();
    fetchBranding(apiBase, controller.signal).then(setBranding).catch(() => undefined);
    return () => controller.abort();
  }, [apiBase]);

  // --- SSE stream discovery ---
  useEffect(() => {
    let eventSource: { close: () => void } | null = null;
    setStatus('loading');
    setError(null);
    setPayload(null);
    setSourceIndex(0);
    setSubtitleIndex(-1);
    setNextCountdown(null);
    setSelectedLevel(null);
    setCurrentAutoLevel(null);
    setHlsLevels([]);
    setBufferedRanges([]);

    accumulatedRef.current = { title: 'Peak', sources: [], subtitles: [], diagnostics: [], done: false };
    firstSourceTsRef.current = null;
    selectedIndexRef.current = 0;

    const buildPayload = (): StreamResponse => {
      const acc = accumulatedRef.current;
      return {
        id: media.id,
        type: media.type,
        title: acc.title,
        year: acc.year,
        sources: acc.sources,
        subtitles: acc.subtitles,
        meta: { latencyMs: 0, providers: acc.diagnostics.length, sources: acc.sources.length },
        diagnostics: acc.diagnostics,
        group: acc.group,
        logo: acc.logo,
      };
    };

    const handleMeta = (data: { title: string; year?: string | number; group?: string; logo?: string }) => {
      accumulatedRef.current.title = data.title || 'Peak';
      accumulatedRef.current.year = data.year;
      accumulatedRef.current.group = data.group;
      accumulatedRef.current.logo = data.logo;
      setPayload(buildPayload());
    };

    const handleSource = (source: Source) => {
      const newIndex = accumulatedRef.current.sources.length;
      accumulatedRef.current.sources.push(source);
      setPayload(buildPayload());

      if (firstSourceTsRef.current === null) {
        firstSourceTsRef.current = Date.now();
        const preferred = preferredSourceIndex(accumulatedRef.current.sources, connectionHint());
        const playable = isPlayableSource(accumulatedRef.current.sources[preferred])
          ? preferred
          : accumulatedRef.current.sources.findIndex(isPlayableSource);
        const index = playable >= 0 ? playable : newIndex;
        selectedIndexRef.current = index;
        setSourceIndex(index);
      }
    };

    const handleSubtitle = (subtitle: Subtitle) => {
      accumulatedRef.current.subtitles.push(subtitle);
      setPayload(buildPayload());
    };

    const handleDiagnostic = (diag: Diagnostic) => {
      accumulatedRef.current.diagnostics.push(diag);
      setPayload(buildPayload());
    };

    const handleDone = () => {
      accumulatedRef.current.done = true;
      setPayload(buildPayload());
      const sources = accumulatedRef.current.sources;
      if (sources.length === 0) {
        setStatus('error');
        setError('No playable sources were returned for this title.');
        return;
      }
      if (!isPlayableSource(sources[selectedIndexRef.current])) {
        const preferred = preferredSourceIndex(sources, connectionHint());
        const candidate = isPlayableSource(sources[preferred])
          ? preferred
          : sources.findIndex(isPlayableSource);
        if (candidate >= 0 && candidate !== selectedIndexRef.current) {
          selectedIndexRef.current = candidate;
          setSourceIndex(candidate);
          setSourceNonce((value) => value + 1);
        }
      }
    };

    const handleError = (err: { error: string; message: string }) => {
      setStatus('error');
      setError(err.message || 'Could not load the stream.');
    };

    (async () => {
      try {
        const fingerprint = await getFingerprint();
        eventSource = fetchStreamEvents(apiBase, media, fingerprint, {
          invalidate: request.invalidate,
          embed: Boolean(embed),
          onMeta: handleMeta,
          onSource: handleSource,
          onSubtitle: handleSubtitle,
          onDiagnostic: handleDiagnostic,
          onDone: handleDone,
          onError: handleError,
        });
      } catch (reason) {
        setStatus('error');
        setError(reason instanceof Error ? reason.message : 'Could not load the stream.');
      }
    })();

    return () => {
      eventSource?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, media.type, media.id, media.season, media.episode, request, embed]);

  // --- Document title ---
  useEffect(() => {
    if (!payload) return;
    document.title = `${payload.title}${payload.year ? ` (${payload.year})` : ''} — ${branding.name}`;
  }, [payload, branding.name]);

  const updateBuffered = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const ranges = calculateBufferedRanges(video.buffered, video.duration);
    setBufferedRanges(ranges);
  }, []);

  // --- Auto-hide controls ---
  const resetInactivityTimer = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (!isScrubbing) {
      hideTimerRef.current = setTimeout(() => setControlsVisible(false), 2500);
    }
  }, [isScrubbing]);

  const showControlsBriefly = useCallback(() => {
    resetInactivityTimer();
  }, [resetInactivityTimer]);

  useEffect(() => {
    if (!playing || isScrubbing) {
      setControlsVisible(true);
      if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
    } else {
      resetInactivityTimer();
    }
    return () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); };
  }, [playing, isScrubbing, resetInactivityTimer]);

  // --- Source loading: Video.js primary, hls.js fallback ---
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !source) return;

    setStatus('loading');
    setError(null);
    setHlsLevels([]);
    setSelectedLevel(null);
    setCurrentAutoLevel(null);

    if (isEmbedSource) {
      setStatus('ready');
      return;
    }

    // Clean up previous
    if (playerRef.current) { try { playerRef.current.dispose(); } catch {} playerRef.current = null; }
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    let ready = false;
    let hls: Hls | null = null;
    const connection = connectionHint();
    const estimate = initialBandwidthEstimate(connection);

    const applyPendingSeek = () => {
      if (pendingSeekRef.current === null || video.readyState < 1) return;
      video.currentTime = pendingSeekRef.current;
      pendingSeekRef.current = null;
    };

    const markReady = () => {
      if (ready) return;
      ready = true;
      applyPendingSeek();
      video.playbackRate = speedRef.current;
      setStatus('ready');
      updateBuffered();
      video.play().catch(() => setNeedsInteraction(true));
    };

    let manifestTimer: NodeJS.Timeout | null = null;
    const startManifestTimeout = () => {
      if (manifestTimer) clearTimeout(manifestTimer);
      manifestTimer = setTimeout(() => { if (!ready) tryAnotherSourceRef.current(); }, FIRST_PLAYABLE_TIMEOUT_MS);
    };
    const clearManifestTimeout = () => { if (manifestTimer) { clearTimeout(manifestTimer); manifestTimer = null; } };

    const onLoadedMetadata = () => {
      if (manifestTimer) { clearTimeout(manifestTimer); manifestTimer = null; }
      applyPendingSeek();
      updateBuffered();
      markReady();
    };
    const onVideoError = () => {
      if (manifestTimer) { clearTimeout(manifestTimer); manifestTimer = null; }
      tryAnotherSourceRef.current();
    };
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('error', onVideoError);

    const navConnection = typeof navigator !== 'undefined'
      ? (navigator as Navigator & { connection?: EventTarget }).connection
      : null;

    const onConnectionChange = () => {
      const activeHls = hlsRef.current;
      if (!activeHls) return;
      const cap = autoQualityCap(connectionHint());
      if (cap !== null && activeHls.levels?.length) {
        const capIndex = capLevelIndex(activeHls.levels, cap);
        if (capIndex >= 0) { activeHls.autoLevelCapping = capIndex; return; }
      }
      activeHls.autoLevelCapping = -1;
    };
    navConnection?.addEventListener?.('change', onConnectionChange);

    // --- Strategy: Video.js primary, hls.js fallback ---
    const initVideoJs = async () => {
      try {
        startManifestTimeout();
        const videojs = (await import('video.js')).default as any;

        const player = videojs(video, {
          html5: { hls: { enableWorker: true, startPosition: -1 } },
          controls: false,
          autoplay: true,
          playsInline: true,
          preload: 'auto',
          inactivityTimeout: 0,
        });
        playerRef.current = player;

        player.src({ src: source.url, type: source.adaptive ? 'application/vnd.apple.mpegurl' : 'application/x-mpegURL' });

        player.on('loadedmetadata', () => { clearManifestTimeout(); applyPendingSeek(); markReady(); });
        player.on('error', () => {
          // If Video.js failed and hls.js is available, try it directly
          if (Hls.isSupported() && !hlsRef.current) initHlsJs();
          else tryAnotherSourceRef.current();
        });
        player.on('play', () => { setPlaying(true); if (!wasPlayingRef.current) { wasPlayingRef.current = true; sendEmbedEvent('play'); } });
        player.on('pause', () => { setPlaying(false); wasPlayingRef.current = false; sendEmbedEvent('pause'); });
        player.on('timeupdate', () => {
          setCurrentTime(player.currentTime());
          const now = Date.now();
          if (now - lastTimeUpdateRef.current >= EMBED_TIMEUPDATE_INTERVAL_MS) {
            lastTimeUpdateRef.current = now;
            sendEmbedEvent('timeupdate', { currentTime: player.currentTime(), duration: Number.isFinite(player.duration()) ? player.duration() : 0 });
          }
        });
        player.on('ended', () => {
          setPlaying(false); wasPlayingRef.current = false;
          sendEmbedEvent('ended', { currentTime: player.currentTime(), duration: Number.isFinite(player.duration()) ? player.duration() : 0 });
          if (media.type === 'tv' && !embed) setNextCountdown(5);
        });

        // Track hls.js levels exposed by VHS
        const vhsHls = (player as unknown as { hls?: Hls }).hls;
        if (vhsHls) {
          hlsRef.current = vhsHls;
          setHlsLevelsFromHls(vhsHls);
        }
      } catch (err) {
        console.warn('[VideoJsEmbedPlayer] Video.js init failed, falling back to hls.js:', err);
        initHlsJs();
      }
    };

    const initHlsJs = () => {
      if (!Hls.isSupported()) {
        // Native HLS (Safari)
        startManifestTimeout();
        video.src = source.url;
        return;
      }

      startManifestTimeout();
      hls = new Hls({ enableWorker: true, capLevelToPlayerSize: true, startLevel: -1, ...(estimate ? { abrEwmaDefaultEstimate: estimate } : {}) });
      hlsRef.current = hls;
      hls.loadSource(source.url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        clearManifestTimeout();
        setHlsLevelsFromHls(hls!);
        markReady();
      });
      hls.on(Hls.Events.ERROR, (_e, data) => { if (!data.fatal) return; tryAnotherSourceRef.current(); });
    };

    const setHlsLevelsFromHls = (hlsInstance: Hls) => {
      if (!hlsInstance.levels?.length) return;
      const levels: LevelOption[] = hlsInstance.levels.map((level, index) => ({
        index, width: level.width, height: level.height, bitrate: level.bitrate,
      }));
      setHlsLevels(levels);
    };

    // Kick off the loading strategy — Video.js is always primary, hls.js is fallback
    initVideoJs();

    return () => {
      clearManifestTimeout();
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('error', onVideoError);
      navConnection?.removeEventListener?.('change', onConnectionChange);
      if (playerRef.current) { try { playerRef.current.dispose(); } catch {} playerRef.current = null; }
      if (hls) hls.destroy();
      if (hlsRef.current === hls) hlsRef.current = null;
      video.removeAttribute('src');
      video.load();
      wasPlayingRef.current = false;
      setPlaying(false);
    };
  }, [source, sourceNonce, updateBuffered, isEmbedSource]); // eslint-disable-line

  // --- Video event listeners for embed bridge ---
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTime = () => {
      setCurrentTime(video.currentTime);
      updateBuffered();
      const now = Date.now();
      if (now - lastTimeUpdateRef.current >= EMBED_TIMEUPDATE_INTERVAL_MS) {
        lastTimeUpdateRef.current = now;
        sendEmbedEvent('timeupdate', { currentTime: video.currentTime, duration: Number.isFinite(video.duration) ? video.duration : 0 });
      }
    };
    const onPlay = () => { setPlaying(true); if (!wasPlayingRef.current) { wasPlayingRef.current = true; sendEmbedEvent('play'); } };
    const onPause = () => { setPlaying(false); wasPlayingRef.current = false; sendEmbedEvent('pause'); };
    const onVolume = () => { setVolume(video.volume); setMuted(video.muted); };
    const onEnded = () => {
      setPlaying(false); wasPlayingRef.current = false;
      sendEmbedEvent('ended', { currentTime: video.currentTime, duration: Number.isFinite(video.duration) ? video.duration : 0 });
      if (media.type === 'tv' && !embed) setNextCountdown(5);
    };

    video.addEventListener('timeupdate', onTime);
    video.addEventListener('progress', updateBuffered);
    video.addEventListener('durationchange', () => setDuration(Number.isFinite(video.duration) ? video.duration : 0));
    video.addEventListener('play', onPlay);
    video.addEventListener('playing', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('volumechange', onVolume);
    video.addEventListener('ended', onEnded);

    return () => {
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('progress', updateBuffered);
      video.removeEventListener('durationchange', () => {});
      video.removeEventListener('play', onPlay);
      video.removeEventListener('playing', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('volumechange', onVolume);
      video.removeEventListener('ended', onEnded);
    };
  }, [media.type, embed, updateBuffered, sendEmbedEvent]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speed;
    playerRef.current?.playbackRate(speed);
  }, [speed]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const tracks = video.textTracks;
    for (let i = 0; i < tracks.length; i += 1) {
      tracks[i].mode = i === subtitleIndex ? 'showing' : 'disabled';
    }
  }, [subtitleIndex, payload?.subtitles.length, status]);

  useEffect(() => {
    if (nextCountdown === null) return;
    if (nextCountdown <= 0) {
      router.push(`/tv/${media.id}/${media.season ?? 1}/${(media.episode ?? 1) + 1}`);
      return;
    }
    const timer = setTimeout(() => setNextCountdown((v) => (v === null ? null : v - 1)), 1000);
    return () => clearTimeout(timer);
  }, [nextCountdown, router, media.id, media.season, media.episode]);

  // --- Utility callbacks ---
  const capturePosition = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 1) return;
    if (Number.isFinite(video.currentTime) && video.currentTime > 0) {
      pendingSeekRef.current = video.currentTime;
    }
  }, []);

  const reload = useCallback((invalidate: boolean, resetRetries = true) => {
    capturePosition();
    setSourceIndex(0);
    if (resetRetries) setReloadCount(0);
    attemptedSourcesRef.current = new Set();
    setSelectedLevel(null);
    setSourceNonce((value) => value + 1);
    if (invalidate) {
      setRequest((previous) => ({ token: previous.token + 1, invalidate }));
    }
  }, [capturePosition]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    const player = playerRef.current;
    if (!video && !player) return;
    if (video?.paused) {
      if (video?.ended) video.currentTime = 0;
      player?.play().catch(() => setNeedsInteraction(true));
      video?.play().catch(() => setNeedsInteraction(true));
      setCenterFeedback({ action: 'play', nonce: Date.now() });
    } else {
      player?.pause();
      video?.pause();
      setCenterFeedback({ action: 'pause', nonce: Date.now() });
    }
    showControlsBriefly();
  }, [showControlsBriefly]);

  const changeSource = useCallback((index: number) => {
    capturePosition();
    setSourceIndex(index);
    selectedIndexRef.current = index;
    attemptedSourcesRef.current = new Set();
    setSelectedLevel(null);
    setSourceNonce((v) => v + 1);
  }, [capturePosition]);

  const seek = useCallback((time: number) => {
    const video = videoRef.current;
    const player = playerRef.current;
    if (!video) return;
    video.currentTime = time;
    player?.currentTime(time);
    setCurrentTime(time);
    showControlsBriefly();
  }, [showControlsBriefly]);

  const skip = useCallback((deltaSeconds: number) => {
    const video = videoRef.current;
    const player = playerRef.current;
    if (!video) return;
    const current = Number.isFinite(video.currentTime) ? video.currentTime : 0;
    const dur = Number.isFinite(video.duration) ? video.duration : 0;
    const target = clamp(current + deltaSeconds, 0, dur);
    video.currentTime = target;
    player?.currentTime(target);
    setCurrentTime(target);

    const direction = deltaSeconds < 0 ? 'backward' : 'forward';
    const now = Date.now();
    const isConsecutive = skipFeedbackTimerRef.current !== null &&
      skipFeedbackStateRef.current.direction === direction &&
      now - skipFeedbackStateRef.current.time < 800;
    const seconds = isConsecutive ? skipFeedbackStateRef.current.seconds + 10 : 10;
    skipFeedbackStateRef.current = { direction, seconds, time: now };
    setSkipFeedback({ direction, seconds, nonce: now });
    if (skipFeedbackTimerRef.current) clearTimeout(skipFeedbackTimerRef.current);
    skipFeedbackTimerRef.current = setTimeout(() => {
      setSkipFeedback({ direction: null, seconds: 0, nonce: 0 });
      skipFeedbackTimerRef.current = null;
    }, 850);
    showControlsBriefly();
  }, [showControlsBriefly]);

  const changeVolume = useCallback((next: number) => {
    const video = videoRef.current;
    const player = playerRef.current;
    if (!video) return;
    video.volume = next;
    video.muted = next === 0;
    player?.volume(next);
    setVolume(next);
    setMuted(next === 0);
    showControlsBriefly();
  }, [showControlsBriefly]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    const player = playerRef.current;
    if (!video) return;
    video.muted = !video.muted;
    player?.muted(!video.muted);
    setMuted(video.muted);
    showControlsBriefly();
  }, [showControlsBriefly]);

  const tryAnotherSource = useCallback(() => {
    const sources = payload?.sources ?? [];
    const current = sources[sourceIndex];
    if (current) attemptedSourcesRef.current.add(sourceKey(current, sourceIndex));

    const to = nextSourceIndex(sources, sourceIndex, attemptedSourcesRef.current);
    if (to < 0) {
      if (reloadCount < 2) { setReloadCount((v) => v + 1); reload(true, false); }
      else { setStatus('error'); setError('All sources failed after 2 retries. Please try again later.'); setPlaying(false); }
      return;
    }
    if (switchTimerRef.current) return;
    const from = sourceIndex;
    const servers = sources.map((item) => item.provider || 'unknown');
    setSwitching({ from, to, servers });
    switchTimerRef.current = setTimeout(() => {
      switchTimerRef.current = null;
      setSwitching(null);
      capturePosition();
      setSourceIndex(to);
      selectedIndexRef.current = to;
      setSelectedLevel(null);
      setSourceNonce((v) => v + 1);
    }, 400);
  }, [capturePosition, payload, reload, reloadCount, sourceIndex]);
  tryAnotherSourceRef.current = tryAnotherSource;

  const changeQuality = useCallback(
    (value: string) => {
      if (value === 'auto') {
        setSelectedLevel(null);
        const hls = hlsRef.current;
        if (hls) { hls.currentLevel = -1; hls.nextLevel = -1; }
        if (payload) {
          const preferred = preferredSourceIndex(payload.sources, connectionHint());
          if (payload.sources[preferred]?.adaptive && !payload.sources[sourceIndex]?.adaptive) changeSource(preferred);
        }
        showControlsBriefly();
        return;
      }
      if (value.startsWith('level:')) {
        const level = Number.parseInt(value.slice(6), 10);
        if (!Number.isInteger(level)) return;
        setSelectedLevel(level);
        const hls = hlsRef.current;
        if (hls) hls.currentLevel = level;
        showControlsBriefly();
        return;
      }
      if (value.startsWith('source:')) {
        const index = Number.parseInt(value.slice(7), 10);
        if (!Number.isInteger(index)) return;
        changeSource(index);
        showControlsBriefly();
      }
    },
    [changeSource, payload, sourceIndex, showControlsBriefly],
  );

  // --- Embed event hooks ---
  useEffect(() => {
    if (!embed || status !== 'ready' || !payload || embedReadyRef.current) return;
    embedReadyRef.current = true;
    sendEmbedEvent('ready', { type: media.type, id: media.id, title: payload.title });
  }, [embed, status, payload, media.type, media.id, sendEmbedEvent]);

  useEffect(() => {
    if (!embed || !sourceDescriptor) return;
    const [index, quality, provider, codec] = JSON.parse(sourceDescriptor) as [number, string, string, string];
    sendEmbedEvent('sourcechange', { index, quality, provider, codec });
  }, [embed, sourceDescriptor, sendEmbedEvent]);

  useEffect(() => {
    if (!embed || status !== 'error') return;
    sendEmbedEvent('error', { code: 'STREAM_UNAVAILABLE', message: 'The stream could not be played.' });
  }, [embed, status, sendEmbedEvent]);

  // --- Embed commands from parent ---
  useEffect(() => {
    if (!embed) return;
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return;
      if (!isAllowedOrigin(event.origin, embed.origins)) return;
      const command = parseEmbedCommand(event.data);
      if (!command.ok) return;
      const video = videoRef.current;
      if (!video) return;

      if (command.command === 'play') { if (video.paused) togglePlay(); return; }
      if (command.command === 'pause') { if (!video.paused) togglePlay(); return; }
      if (command.command === 'seek') {
        const value = typeof command.value === 'number' ? command.value : 0;
        const limit = Number.isFinite(video.duration) ? video.duration : value;
        seek(Math.max(0, Math.min(value, limit)));
        return;
      }
      if (command.command === 'setVolume') {
        changeVolume(typeof command.value === 'number' ? command.value : 0);
        return;
      }
      if (command.command === 'setSubtitle') {
        if (typeof command.value === 'number') setSubtitleIndex(command.value);
        return;
      }
      if (command.command === 'setQuality' && typeof command.value === 'string') {
        const value = command.value;
        if (value === 'auto' || value.startsWith('source:') || value.startsWith('level:')) {
          changeQuality(value);
          return;
        }
        const idx = (payload?.sources ?? []).findIndex((item) => item.quality === value);
        if (idx >= 0) changeQuality(`source:${idx}`);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [embed, payload, seek, changeVolume, changeQuality, togglePlay]);

  // --- PiP & Fullscreen ---
  const togglePiP = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await video.requestPictureInPicture();
    } catch { /* refused */ }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await container.requestFullscreen();
    } catch { /* blocked */ }
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement && document.fullscreenElement === containerRef.current);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    setPipSupported(typeof document !== 'undefined' && document.pictureInPictureEnabled);
  }, []);

  // --- Quality options for ControlBar ---
  const adaptiveAvailable = payload?.sources.some((item) => item.adaptive) ?? false;
  const showLevels = source?.adaptive === true && hlsLevels.length > 0;
  const qualityOptions: QualityOption[] = [];
  const seenQualities = new Set<string>();

  if (adaptiveAvailable) {
    const activeLevel = selectedLevel === null && currentAutoLevel !== null && hlsLevels[currentAutoLevel]
      ? hlsLevels[currentAutoLevel] : null;
    const activeLabel = activeLevel ? levelLabel(activeLevel) : null;
    qualityOptions.push({ value: 'auto', label: activeLabel ? `Auto (${activeLabel})` : 'Auto' });
  }

  if (showLevels) {
    for (const level of sortLevelsDescending(hlsLevels)) {
      const label = levelLabel(level);
      if (seenQualities.has(label)) continue;
      seenQualities.add(label);
      qualityOptions.push({ value: `level:${level.index}`, label });
    }
  } else if (payload) {
    payload.sources.forEach((item, index) => {
      if (item.adaptive || seenQualities.has(item.quality)) return;
      seenQualities.add(item.quality);
      qualityOptions.push({ value: `source:${index}`, label: item.quality });
    });
  }

  const qualityValue = showLevels && selectedLevel !== null
    ? `level:${selectedLevel}`
    : source?.adaptive ? 'auto'
    : `source:${sourceIndex}`;

  // --- Render ---
  const style = { '--accent': branding.accentColor } as CSSProperties;
  const episodeLabel = media.type === 'tv' ? `S${media.season ?? 1} • E${media.episode ?? 1}` : undefined;
  const liveLabel = media.type === 'live_tv' ? payload?.group : undefined;

  return (
    <div
      ref={containerRef}
      className={`player-root ${controlsVisible ? 'controls-active' : 'controls-inactive'} ${isFullscreen ? 'fullscreen-mode' : ''}`}
      style={style}
      onPointerMove={showControlsBriefly}
      onClick={showControlsBriefly}
    >
      <AmbientBackground accentColor={branding.accentColor} />

      {isEmbedSource && source && (
        <ExternalEmbed
          key={`${source.url}-${sourceNonce}`}
          url={source.url}
          title={payload?.title ? `${payload.title} — external provider` : 'External player'}
        />
      )}

      <video
        ref={videoRef}
        className={isEmbedSource ? 'player-video hidden' : 'player-video'}
        playsInline
        autoPlay
        crossOrigin="anonymous"
      />

      <MobileGestureLayer
        onSingleTap={() => { if (!controlsVisible) setControlsVisible(true); else togglePlay(); }}
        onDoubleTapLeft={() => skip(-10)}
        onDoubleTapRight={() => skip(10)}
      />

      <div className={`player-vignette-scrim ${controlsVisible ? 'visible' : 'hidden'}`} aria-hidden="true" />

      <PlayerHeader
        branding={branding}
        title={payload?.title ? `${payload.title}${payload.year ? ` (${payload.year})` : ''}` : undefined}
        subtitle={media.type === 'live_tv' ? liveLabel : episodeLabel}
        currentProvider={source?.provider}
        visible={controlsVisible}
      />

      <CenterFeedback action={centerFeedback.action} feedbackNonce={centerFeedback.nonce} />

      <SkipFeedback direction={skipFeedback.direction} seconds={skipFeedback.seconds} nonce={skipFeedback.nonce} />

      {status === 'loading' && (
        <LoadingSkeleton
          branding={branding}
          poster={media.poster ?? payload?.logo}
          label={payload ? 'Preparing stream…' : (media.type === 'live_tv' ? 'Loading channel…' : 'Fetching sources…')}
        />
      )}

      {switching && (
        <div className="server-switcher" aria-live="polite">
          <div className="server-switcher-label">Switching server…</div>
          <div className="server-list">
            {switching.servers.map((server, index) => {
              const isActive = index === switching.to;
              const isExiting = index === switching.from;
              return (
                <div key={`${server}-${index}`} className={`server-item ${isActive ? 'active' : ''} ${isExiting ? 'exiting' : ''}`}>
                  <span className="server-code">{server.toUpperCase()}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {status === 'error' && (
        <ErrorState
          title="Stream unavailable"
          message={embed ? 'This stream is unavailable in the embedded player.' : error ?? 'Something went wrong while loading this title.'}
          diagnostics={embed ? undefined : payload?.diagnostics}
          onTryAnother={tryAnotherSource}
          onReload={() => reload(true)}
        />
      )}

      {nextCountdown !== null && (
        <div className="next-layer">
          <div className="next-card">
            <p className="next-kicker">Up next</p>
            <h3>Episode {(media.episode ?? 1) + 1}</h3>
            <p>Playing in {nextCountdown}s</p>
            <div className="next-actions">
              <button type="button" className="button primary" onClick={() => router.push(`/tv/${media.id}/${media.season ?? 1}/${(media.episode ?? 1) + 1}`)}>
                Play now
              </button>
              <button type="button" className="button ghost" onClick={() => setNextCountdown(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {payload && status !== 'error' && (
        <>
          <ControlBar
            playing={playing}
            currentTime={currentTime}
            duration={duration}
            bufferedRanges={bufferedRanges}
            volume={volume}
            muted={muted}
            qualityOptions={qualityOptions}
            qualityValue={qualityValue}
            subtitles={payload.subtitles}
            subtitleIndex={subtitleIndex}
            speed={speed}
            pipSupported={pipSupported}
            isFullscreen={isFullscreen}
            visible={controlsVisible}
            onTogglePlay={togglePlay}
            onSeek={seek}
            onSkip={skip}
            onVolume={changeVolume}
            onToggleMute={toggleMute}
            onQualityChange={changeQuality}
            onSubtitleChange={setSubtitleIndex}
            onSpeedChange={setSpeed}
            onPiP={togglePiP}
            onFullscreen={toggleFullscreen}
            onScrubbingChange={setIsScrubbing}
          />
          <MobilePlayerControls
            playing={playing}
            currentTime={currentTime}
            duration={duration}
            bufferedRanges={bufferedRanges}
            muted={muted}
            qualityOptions={qualityOptions}
            qualityValue={qualityValue}
            subtitles={payload.subtitles}
            subtitleIndex={subtitleIndex}
            speed={speed}
            isFullscreen={isFullscreen}
            visible={controlsVisible}
            title={payload.title}
            subtitle={media.type === 'live_tv' ? liveLabel : episodeLabel}
            onTogglePlay={togglePlay}
            onSeek={seek}
            onSkip={skip}
            onToggleMute={toggleMute}
            onQualityChange={changeQuality}
            onSubtitleChange={setSubtitleIndex}
            onSpeedChange={setSpeed}
            onFullscreen={toggleFullscreen}
            onScrubbingChange={setIsScrubbing}
          />
        </>
      )}
    </div>
  );
}
