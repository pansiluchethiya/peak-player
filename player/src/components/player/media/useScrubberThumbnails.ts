'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type Hls from 'hls.js';
import type { Source } from '../../../lib/types';

const THUMB_WIDTH = 160;
const THUMB_HEIGHT = 90;
const SEEK_TIMEOUT_MS = 2500;
/* Hover previews are ~8 KB each; cap the cache so scrubbing a long film can
 * never grow the tab's heap without bound. */
const MAX_FRAMES = 48;

function isHlsSource(source: Source): boolean {
  const container = source.container?.toLowerCase();
  const path = source.url.split(/[?#]/, 1)[0]?.toLowerCase() ?? '';
  return source.adaptive === true || container === 'hls' || path.endsWith('.m3u8');
}

/**
 * Captures hover-preview frames from a hidden sibling video element. The main
 * player is never seeked, so previews cannot interrupt playback. Frames are
 * cached per second and reused as the pointer moves along the timeline.
 */
export function useScrubberThumbnails(source: Source | null) {
  const [frames, setFrames] = useState<Map<number, string>>(() => new Map());
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const cacheRef = useRef(new Map<number, string>());
  const busyRef = useRef(false);
  const pendingRef = useRef<number | null>(null);
  const lastRequestRef = useRef(-1);
  const disposedRef = useRef(false);
  const timerRef = useRef(0);
  const captureRef = useRef<(time: number) => void>(() => {});

  const sourceUrl = source?.url ?? null;
  const hlsSource = source ? isHlsSource(source) : false;

  useEffect(() => {
    if (!sourceUrl || typeof document === 'undefined') return;
    disposedRef.current = false;
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.crossOrigin = 'anonymous';
    video.setAttribute('aria-hidden', 'true');
    Object.assign(video.style, {
      position: 'fixed',
      left: '-10000px',
      top: '0',
      width: `${THUMB_WIDTH}px`,
      height: `${THUMB_HEIGHT}px`,
      opacity: '0',
      pointerEvents: 'none',
    });
    document.body.appendChild(video);
    videoRef.current = video;

    const draw = () => {
      if (disposedRef.current || !busyRef.current) return;
      window.clearTimeout(timerRef.current);
      busyRef.current = false;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = THUMB_WIDTH;
        canvas.height = THUMB_HEIGHT;
        const context = canvas.getContext('2d');
        if (context && video.videoWidth > 0) {
          context.drawImage(video, 0, 0, THUMB_WIDTH, THUMB_HEIGHT);
          cacheRef.current.set(Math.round(video.currentTime), canvas.toDataURL('image/jpeg', 0.62));
          while (cacheRef.current.size > MAX_FRAMES) {
            const oldest = cacheRef.current.keys().next().value;
            if (oldest === undefined) break;
            cacheRef.current.delete(oldest);
          }
          setFrames(new Map(cacheRef.current));
        }
      } catch {
        // Cross-origin frames can taint the canvas; previews are best-effort.
      }
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (pending != null) captureRef.current(pending);
    };

    const onSeeked = () => draw();
    const onReady = () => {
      if (pendingRef.current != null) {
        const pending = pendingRef.current;
        pendingRef.current = null;
        captureRef.current(pending);
      }
    };
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('loadeddata', onReady);

    let cancelled = false;
    if (hlsSource) {
      void (async () => {
        try {
          const { default: HlsCtor } = await import('hls.js');
          if (cancelled) return;
          if (HlsCtor.isSupported()) {
            const hls = new HlsCtor({
              maxBufferLength: 4,
              maxMaxBufferLength: 6,
              backBufferLength: 0,
              enableWorker: true,
            });
            hlsRef.current = hls;
            hls.loadSource(sourceUrl);
            hls.attachMedia(video);
          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = sourceUrl;
          }
        } catch {
          // The preview layer silently degrades to a timecode tooltip.
        }
      })();
    } else {
      video.src = sourceUrl;
    }

    return () => {
      cancelled = true;
      disposedRef.current = true;
      window.clearTimeout(timerRef.current);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('loadeddata', onReady);
      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.removeAttribute('src');
      video.load();
      video.remove();
      videoRef.current = null;
      busyRef.current = false;
      pendingRef.current = null;
      lastRequestRef.current = -1;
    };
  }, [hlsSource, sourceUrl]);

  const capture = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video || disposedRef.current) return;
    const key = Math.round(time);
    if (cacheRef.current.has(key)) return;
    if (busyRef.current) {
      pendingRef.current = time;
      return;
    }
    if (Math.abs(key - lastRequestRef.current) < 1) return;
    lastRequestRef.current = key;

    if (video.readyState < 2) {
      pendingRef.current = time;
      return;
    }

    const target = Math.max(0, Math.min(time, Number.isFinite(video.duration) ? video.duration : time));
    busyRef.current = true;
    timerRef.current = window.setTimeout(() => {
      busyRef.current = false;
      pendingRef.current = null;
    }, SEEK_TIMEOUT_MS);
    if (Math.abs(video.currentTime - target) < 0.01) {
      video.dispatchEvent(new Event('seeked'));
      return;
    }
    video.currentTime = target;
  }, []);

  captureRef.current = capture;

  return { frames, requestFrame: capture };
}
