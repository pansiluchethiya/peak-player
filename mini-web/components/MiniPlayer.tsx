'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const PLAYER_URL = process.env.NEXT_PUBLIC_PLAYER_URL || 'http://localhost:3011';

interface SessionResponse {
  success: boolean;
  embedUrl?: string;
  token?: string;
  error?: string;
  message?: string;
}

interface PlayerInstance {
  on(event: string, handler: (payload?: unknown) => void): PlayerInstance;
  off(event: string, handler: (payload?: unknown) => void): PlayerInstance;
  destroy(): void;
}

interface PeakEmbedSDK {
  version: number;
  v2: { mount: (opts: Record<string, unknown>) => PlayerInstance };
  mount: (opts: Record<string, unknown>) => PlayerInstance;
}

interface Props {
  mediaType?: string;
  mediaId?: string;
  className?: string;
}

const MAX_AUTO_RETRIES = 1;

function loadSdk(): Promise<PeakEmbedSDK> {
  return new Promise((resolve, reject) => {
    const existing = (window as unknown as { PeakEmbed?: PeakEmbedSDK }).PeakEmbed;
    if (existing) {
      resolve(existing);
      return;
    }

    const script = document.createElement('script');
    script.src = `${PLAYER_URL}/peak-embed.js`;
    script.async = true;
    script.onload = () => {
      const sdk = (window as unknown as { PeakEmbed?: PeakEmbedSDK }).PeakEmbed;
      if (sdk) resolve(sdk);
      else reject(new Error('PeakEmbed SDK loaded but did not register'));
    };
    script.onerror = () => reject(new Error(`Failed to load the Peak player SDK from ${PLAYER_URL}`));
    document.head.appendChild(script);
  });
}

async function createSession(mediaType: string, mediaId: string): Promise<string> {
  const response = await fetch('/api/embed/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: mediaType, id: mediaId }),
    cache: 'no-store',
  });

  const session = (await response.json().catch(() => ({}))) as SessionResponse;
  if (!response.ok || !session.success || !session.embedUrl) {
    throw new Error(
      session.message || session.error || `Session request failed (${response.status})`,
    );
  }
  return session.embedUrl;
}

export default function MiniPlayer({ mediaType = 'movie', mediaId = '550', className = '' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<PlayerInstance | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    async function init() {
      try {
        setStatus('loading');
        setError(null);

        // 1. Mint a signed embed session through the server-side proxy. The
        //    partner API key never reaches the browser.
        const embedUrl = await createSession(mediaType, mediaId);
        if (cancelled) return;

        // 2. Load the Peak Embed SDK from the player origin.
        const sdk = await loadSdk();
        if (cancelled || !containerRef.current) return;

        // 3. Mount the player in SDK v2 mode.
        const player = sdk.v2.mount({
          target: containerRef.current,
          url: embedUrl,
          title: 'Peak mini-web player',
          width: '100%',
          height: '100%',
        });

        playerRef.current = player;
        setStatus('ready');

        player.on('error', (payload) => {
          const event = payload as { code?: string; message?: string } | undefined;
          if (event?.message) setError(`${event.code || 'PLAYER_ERROR'}: ${event.message}`);
        });
      } catch (cause) {
        if (cancelled) return;
        const message = cause instanceof Error ? cause.message : 'Something went wrong';
        setError(message);
        setStatus('error');

        // The API or player may still be starting up; retry once automatically.
        if (attempt < MAX_AUTO_RETRIES) {
          retryTimer = setTimeout(() => setAttempt((value) => value + 1), 1500);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          /* the iframe may already be gone */
        }
        playerRef.current = null;
      }
    };
  }, [mediaType, mediaId, attempt]);

  return (
    <div className={`mini-player ${status} ${className}`.trim()}>
      {status === 'loading' && (
        <div className="mini-state" role="status" aria-live="polite">
          <div className="mini-spinner" aria-hidden="true" />
          <p>Preparing your player…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="mini-state" role="alert">
          <strong>Player unavailable</strong>
          <p>Could not start a playback session.</p>
          {error && <p className="mini-error">{error}</p>}
          <button type="button" onClick={retry}>
            Try again
          </button>
        </div>
      )}

      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
