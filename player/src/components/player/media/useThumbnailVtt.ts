'use client';

import { useEffect, useState } from 'react';
import { parseThumbnailVtt, type ThumbnailVtt } from '../../../lib/thumbnails';

/**
 * Loads a provider's remote sprite sheet. The VTT is tiny and cached by the
 * browser, so it replaces local frame capture without buffering extra video.
 */
export function useThumbnailVtt(url: string | null | undefined): ThumbnailVtt | null {
  const [vtt, setVtt] = useState<ThumbnailVtt | null>(null);

  useEffect(() => {
    setVtt(null);
    if (!url || typeof fetch !== 'function') return;
    let cancelled = false;
    fetch(url)
      .then((response) => (response.ok ? response.text() : ''))
      .then((text) => {
        if (!cancelled) setVtt(text ? parseThumbnailVtt(text, url) : null);
      })
      .catch(() => {
        if (!cancelled) setVtt(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return vtt;
}
