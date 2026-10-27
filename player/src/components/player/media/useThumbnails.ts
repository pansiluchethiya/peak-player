'use client';
import { useEffect, useState } from 'react';
import { usePlayerContext } from '../PlayerProvider';

export interface Thumbnail {
/** Capture time in seconds for this thumbnail. */
  time: number;
  url: string;
}

/**
 * Polls `api.snapshot()` and caches frames for use by the scrubber preview
 * (spec §6.8). Returns the most recent thumbnail and a refresh function.
 */
export function useThumbnails(intervalMs = 2000): Thumbnail[] {
  const { api } = usePlayerContext();
  const [thumbnails, setThumbnails] = useState<Thumbnail[]>([]);

  useEffect(() => {
    let cancelled = false;
    let frame = 0;
    const tick = async () => {
      const state = api.getState();
      if (state.duration && state.currentTime) {
        try {
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const id = setTimeout(() => reject(new Error('timeout')), 1000);
            api.snapshot().then((url) => { clearTimeout(id); resolve(url); }).catch(reject);
          });
          if (!cancelled) {
            setThumbnails((list) => {
              const next = [...list, { time: state.currentTime, url: dataUrl }];
              return next.length > 30 ? next.slice(next.length - 30) : next;
            });
          }
        } catch {
          // snapshot may fail while seeking or when video is not painted yet
        }
      }
      if (!cancelled) frame = window.requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [api, intervalMs]);

  return thumbnails;
}
