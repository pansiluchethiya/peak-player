'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MediaMetadata, MediaType } from '../../../lib/types';
import { TypographicCard } from './TypographicCard';

const ARTWORK_TIMEOUT_MS = 4000;
const ARTWORK_CACHE_PREFIX = 'peak:artwork:';

export interface ArtworkLoadOptions {
  /** Injectable image loader; resolves with the URL that decoded successfully. */
  load?: (url: string) => Promise<string>;
  timeoutMs?: number;
}

export interface ArtworkChainProps {
  /** Resolver record from the stream `meta` event. */
  media?: MediaMetadata | null;
  /** Fallback identity when the record has not arrived yet. */
  type?: MediaType;
  mediaId?: string;
  title?: string;
  year?: number | string | null;
  /** Embed/query poster override (chain step 1). */
  partnerPoster?: string | null;
  /** Scraper-provided artwork (chain step 6). */
  providerArtwork?: string | null;
  /** Explicit list; bypasses the media-derived chain. */
  candidates?: string[];
  className?: string;
  alt?: string;
  /** Use the bundled `/poster-fallback.svg` as the typographic card background. */
  fallbackArt?: boolean;
  timeoutMs?: number;
}

/**
 * Creates an `Image`, sets `src`, and resolves on `onload`. 404s and decode
 * errors reject through `onerror`; a stalled image rejects after the timeout.
 */
export function loadImage(url: string, timeoutMs = ARTWORK_TIMEOUT_MS): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof Image === 'undefined') {
      reject(new Error('ARTWORK_UNAVAILABLE'));
      return;
    }
    const image = new Image();
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      image.onload = null;
      image.onerror = null;
      reject(new Error('ARTWORK_TIMEOUT'));
    }, timeoutMs);

    image.onload = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(url);
    };
    image.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error('ARTWORK_DECODE'));
    };
    image.src = url;
  });
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('ARTWORK_TIMEOUT'));
    }, timeoutMs);
    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Walks candidates sequentially. A reject, decode error or timeout advances to
 * the next URL; resolves the first URL that loads, or `null` when all fail.
 */
export async function resolveArtwork(
  candidates: string[],
  { load = loadImage, timeoutMs = ARTWORK_TIMEOUT_MS }: ArtworkLoadOptions = {},
): Promise<string | null> {
  const seen = new Set<string>();
  for (const candidate of candidates ?? []) {
    if (typeof candidate !== 'string') continue;
    const url = candidate.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    try {
      const loaded = await withTimeout(Promise.resolve().then(() => load(url)), timeoutMs);
      if (typeof loaded === 'string' && loaded) return loaded;
    } catch {
      // 404, decode error, timeout: keep walking.
    }
  }
  return null;
}

/**
 * Deterministic two-stop gradient for the typographic card. The hue values are
 * hash-derived as the spec asks, but saturation stays at 0% so the card remains
 * monochrome under the AMOLED palette; the visible variation is lightness.
 */
export function artworkGradient(title: string): string {
  const text = typeof title === 'string' ? title : '';
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const unsigned = hash >>> 0;
  const hueA = unsigned % 360;
  const hueB = (hueA + 47 + ((unsigned >>> 9) % 131)) % 360;
  const lightA = 7 + ((unsigned >>> 3) % 8);
  const lightB = 15 + ((unsigned >>> 13) % 11);
  return `linear-gradient(145deg, hsl(${hueA} 0% ${lightA}%) 0%, hsl(${hueB} 0% ${lightB}%) 100%)`;
}

/**
 * Client mirror of `utils/artworkResolver.js`: chain steps 1-6, deduped. Steps
 * 7-8 are render fallbacks in `ArtworkChain`, never URL candidates.
 */
export function mediaArtworkCandidates(
  media: MediaMetadata | null | undefined,
  { partnerPoster, providerArtwork }: { partnerPoster?: string | null; providerArtwork?: string | null } = {},
): string[] {
  const candidates: string[] = [];
  const add = (value: string | null | undefined) => {
    if (typeof value !== 'string') return;
    const url = value.trim();
    if (!url || candidates.includes(url)) return;
    candidates.push(url);
  };

  add(partnerPoster);
  for (const poster of media?.poster?.candidates ?? []) add(poster);
  add(media?.backdrop);
  for (const still of media?.stills ?? []) add(still);
  add(media?.seriesPoster);
  add(providerArtwork);

  return candidates;
}

function artworkKey(type: MediaType | undefined, id: string | undefined): string | null {
  if (!type || !id) return null;
  return `${ARTWORK_CACHE_PREFIX}${type}:${id}`;
}

function readArtwork(key: string | null): string | null {
  if (!key || typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeArtwork(key: string | null, url: string): void {
  if (!key || typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(key, url);
  } catch {
    // Private mode / storage quota: the in-memory URL is still enough.
  }
}

function clearArtwork(key: string | null): void {
  if (!key || typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignore storage failures.
  }
}

/**
 * Resolves the poster chain and renders the image, or the typographic card when
 * every remote candidate fails. Resolved URLs are cached per title in
 * `sessionStorage`.
 */
export function ArtworkChain({
  media,
  type: fallbackType,
  mediaId,
  title,
  year,
  partnerPoster,
  providerArtwork,
  candidates,
  className,
  alt,
  fallbackArt = false,
  timeoutMs = ARTWORK_TIMEOUT_MS,
}: ArtworkChainProps) {
  const chain = useMemo(
    () =>
      candidates ?? mediaArtworkCandidates(media, { partnerPoster, providerArtwork }),
    [candidates, media, partnerPoster, providerArtwork],
  );
  const chainKey = chain.join('\n');
  const type = media?.type ?? fallbackType;
  const id = media?.id ?? mediaId;
  const storageKey = artworkKey(type, id);
  const resolvedTitle = media?.title ?? title;
  const resolvedYear = media?.year ?? year ?? null;

  const [url, setUrl] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const failedRef = useRef<Set<string>>(new Set());

  // A different title starts a fresh failure set.
  useEffect(() => {
    failedRef.current = new Set();
  }, [storageKey]);

  useEffect(() => {
    let cancelled = false;
    const cached = readArtwork(storageKey);
    if (cached) {
      setUrl(cached);
      return () => {
        cancelled = true;
      };
    }
    setUrl(null);
    const pending = chain.filter((candidate) => !failedRef.current.has(candidate));
    if (pending.length === 0) {
      return () => {
        cancelled = true;
      };
    }
    resolveArtwork(pending, { timeoutMs }).then((found) => {
      if (cancelled) return;
      setUrl(found);
      if (found) writeArtwork(storageKey, found);
    });
    return () => {
      cancelled = true;
    };
    // `chainKey` keeps the walk stable across resolver re-publishes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainKey, storageKey, timeoutMs, attempt]);

  const handleImageError = useCallback(() => {
    if (url) failedRef.current.add(url);
    clearArtwork(storageKey);
    setUrl(null);
    setAttempt((value) => value + 1);
  }, [storageKey, url]);

  if (url) {
    return (
      <img
        className={className}
        src={url}
        alt={alt ?? ''}
        draggable={false}
        onError={handleImageError}
      />
    );
  }

  return (
    <TypographicCard
      className={className}
      title={resolvedTitle}
      year={resolvedYear}
      type={type}
      gradient={artworkGradient(resolvedTitle ?? '')}
      backgroundArt={fallbackArt}
    />
  );
}
