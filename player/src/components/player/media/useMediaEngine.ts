'use client';

import { getMediaElement, useMedia } from '@videojs/react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { PeakPlayerError } from '../errors';
import { t } from '../i18n';
import { usePlayerContext } from '../PlayerProvider';
import type { CaptionPreferences } from '../prefs/schema';
import { VolumeBoost } from '../audio/VolumeBoost';

/**
 * Imperative surface of the media engine. Only {@link PlayerProvider} calls these;
 * every public action goes through `PlayerApi`, which awaits this handle and
 * rejects with `NOT_READY` until the media element has attached.
 */
export interface EngineHandle {
  play(): Promise<void>;
  pause(): void;
  seek(t: number): Promise<void>;
  setVolume(v: number): void;
  setMuted(m: boolean): void;
  setSpeed(v: number): void;
  setBoost(value: number, unlocked: boolean): void;
  setQuality(level: 'auto' | string): void;
  setAudioTrack(id: string): void;
  setCaptions(options: Partial<CaptionPreferences>): void;
  seekToLive(edge: number): Promise<void>;
  requestFullscreen(): Promise<void>;
  exitFullscreen(): Promise<void>;
  requestPictureInPicture(): Promise<void>;
  snapshot(): Promise<string>;
}

/** Plain snapshot of engine-owned state, read outside the engine's render tree. */
export interface EngineSnapshot {
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  speed: number;
  quality: string;
  audioTrack: string | null;
  captionsEnabled: boolean;
  fullscreen: boolean;
  pip: boolean;
  live: boolean;
  liveEdgeStart: number;
  targetLiveWindow: number;
}

/**
 * Bridges the `@videojs/react` store to {@link EngineHandle} and publishes the
 * engine snapshot the provider needs for `PlayerApi.getState()`.
 */
export function useMediaEngine(register: (handle: EngineHandle | null) => void): void {
  const { useEnginePlayer } = usePlayerContext();
  const store = useEnginePlayer();
  const media = useMedia();
  const { setEngineStateReader } = usePlayerContext();
  const boostRef = useRef<VolumeBoost | null>(null);

  const readEngineState = useCallback((): EngineSnapshot => {
    const state = store.state;
    return {
      playing: !state.paused,
      currentTime: Number.isFinite(state.currentTime) ? state.currentTime : 0,
      duration: Number.isFinite(state.duration) ? state.duration : 0,
      volume: state.volume,
      muted: state.muted,
      speed: state.playbackRate,
      quality: state.activeVideoRendition?.selected ? state.activeVideoRendition.id : 'auto',
      audioTrack: state.audioTrackList.find((track) => track.enabled)?.id ?? null,
      captionsEnabled: state.subtitlesShowing,
      fullscreen: state.isFullscreen,
      pip: state.isPictureInPicture,
      live: Number.isFinite(state.liveEdgeStart),
      liveEdgeStart: state.liveEdgeStart,
      targetLiveWindow: state.targetLiveWindow,
    };
  }, [store]);

  // A registered handle can outlive the media element (external iframe, a source
  // swap, or teardown). Every action rejects `UNSUPPORTED` in that window rather
  // than operating on a store with nothing attached.
  const requireElement = useCallback((): HTMLVideoElement => {
    const element = getMediaElement(media);
    if (!element) {
      throw new PeakPlayerError('UNSUPPORTED', t('media-unavailable'));
    }
    return element as HTMLVideoElement;
  }, [media]);

  const handle = useMemo<EngineHandle>(() => {
    return {
      play: () => {
        requireElement();
        return store.play();
      },
      pause: () => {
        requireElement();
        store.pause();
      },
      seek: async (time: number) => {
        requireElement();
        await store.seek(time);
      },
      setVolume: (value: number) => {
        requireElement();
        store.setVolume(value);
      },
      setMuted: (value: boolean) => {
        requireElement();
        store.setMuted(value);
      },
      setSpeed: (value: number) => {
        requireElement();
        store.setPlaybackRate(value);
      },
      // Volume boost is an audio-graph concern (MediaElementSource → GainNode →
      // DynamicsCompressor) delivered in Task 17 via the VolumeBoost class.
      setBoost: (value: number, unlocked: boolean) => {
        requireElement();
        const element = getMediaElement(media) as HTMLVideoElement | null;
        if (!element) throw new PeakPlayerError('UNSUPPORTED', t('media-unavailable'));
        if (!boostRef.current) boostRef.current = new VolumeBoost(new (window.AudioContext || (window as unknown as { AudioContext: typeof AudioContext }).AudioContext)(), element);
        boostRef.current.setBoost(value, unlocked);
      },
      setQuality: (level: 'auto' | string) => {
        requireElement();
        store.selectVideoRendition(level);
      },
      setAudioTrack: (id: string) => {
        requireElement();
        store.selectAudioTrack(id);
      },
      setCaptions: (options: Partial<CaptionPreferences>) => {
        requireElement();
        if (options.enabled === false) {
          store.selectSubtitlesTrack(null);
          return;
        }
        const tracks = store.state.textTrackList;
        const wanted = options.language ?? null;
        const match = wanted
          ? tracks.find((track) => track.language === wanted || track.label === wanted || track.id === wanted)
          : undefined;
        if (match) {
          store.selectSubtitlesTrack(match.id);
          return;
        }
        if (options.enabled === true) store.toggleSubtitles(true);
      },
      seekToLive: async (edge: number) => {
        requireElement();
        const state = readEngineState();
        const target = Number.isFinite(state.liveEdgeStart)
          ? Math.max(0, state.liveEdgeStart - Math.max(0, edge))
          : state.duration;
        await store.seek(target);
      },
      requestFullscreen: () => {
        requireElement();
        return store.requestFullscreen();
      },
      exitFullscreen: () => {
        requireElement();
        return store.exitFullscreen();
      },
      requestPictureInPicture: () => {
        requireElement();
        return store.requestPictureInPicture();
      },
      snapshot: async () => {
        const element = requireElement();
        if (!element.videoWidth || !element.videoHeight) {
          throw new PeakPlayerError('NOT_READY', t('frame-unavailable'));
        }
        const canvas = document.createElement('canvas');
        canvas.width = element.videoWidth;
        canvas.height = element.videoHeight;
        const context = canvas.getContext('2d');
        if (!context) {
          throw new PeakPlayerError('UNSUPPORTED', t('capture-unsupported'));
        }
        try {
          context.drawImage(element, 0, 0, canvas.width, canvas.height);
          return canvas.toDataURL('image/png');
        } catch {
          throw new PeakPlayerError('PERMISSION_DENIED', t('capture-blocked'));
        }
      },
    };
  }, [media, readEngineState, requireElement, store]);

  useEffect(() => {
    register(handle);
    return () => register(null);
  }, [handle, register]);

  useEffect(() => {
    setEngineStateReader(readEngineState);
    return () => setEngineStateReader(null);
  }, [readEngineState, setEngineStateReader]);
}
