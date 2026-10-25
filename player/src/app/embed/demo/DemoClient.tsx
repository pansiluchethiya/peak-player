'use client';

import { useEffect, useRef, useState } from 'react';

interface DemoSession {
  embedUrl: string;
  expiresAt?: string;
  partner?: { id: string; name: string };
  token?: string;
}

interface PeakEmbedInstance {
  on(event: string, handler: (payload?: unknown) => void): PeakEmbedInstance;
  off(event: string, handler: (payload?: unknown) => void): PeakEmbedInstance;
  play(): boolean;
  pause(): boolean;
  seek(seconds: number): boolean;
  setVolume(value: number): boolean;
  setSubtitle(value: number | string): boolean;
  setQuality(value: string): boolean;
  destroy(): void;
}

interface PeakEmbedSdk {
  mount(options: {
    target: HTMLElement;
    url: string;
    title?: string;
    width?: string;
    height?: string;
  }): PeakEmbedInstance;
}

function getSdk(): PeakEmbedSdk | undefined {
  return (window as Window & { PeakEmbed?: PeakEmbedSdk }).PeakEmbed;
}

export function DemoClient() {
  const [session, setSession] = useState<DemoSession | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [sdkReady, setSdkReady] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [events, setEvents] = useState<string[]>([]);
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<PeakEmbedInstance | null>(null);
  const lastTimeEventRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/embed/demo')
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as {
          embedUrl?: string;
          expiresAt?: string;
          partner?: { id: string; name: string };
          token?: string;
          message?: string;
        };
        if (!response.ok || !data.embedUrl) {
          throw new Error(data.message || 'The demo session is not configured.');
        }
        if (!cancelled) {
          setSession(data as DemoSession);
          setStatus('ready');
        }
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setStatus('error');
        setError(reason instanceof Error ? reason.message : 'The demo session is not configured.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (getSdk()) {
      setSdkReady(true);
      return;
    }
    const script = document.createElement('script');
    script.src = '/peak-embed.js';
    script.async = true;
    script.onload = () => setSdkReady(true);
    script.onerror = () => {
      setStatus('error');
      setError('Could not load the Peak embed SDK.');
    };
    document.body.appendChild(script);
    return () => {
      script.remove();
    };
  }, []);

  useEffect(() => {
    if (!sdkReady || !session?.embedUrl || !mountRef.current) return;
    const sdk = getSdk();
    if (!sdk) return;

    const instance = sdk.mount({
      target: mountRef.current,
      url: session.embedUrl,
      title: 'Peak embed demo',
    });
    playerRef.current = instance;

    const names = ['ready', 'play', 'pause', 'ended', 'timeupdate', 'sourcechange', 'error'] as const;
    const handlers = names.map((name) => {
      const handler = (payload?: unknown) => {
        if (name === 'timeupdate') {
          const now = Date.now();
          if (now - lastTimeEventRef.current < 1000) return;
          lastTimeEventRef.current = now;
        }
        const line = payload === undefined ? name : `${name} ${JSON.stringify(payload)}`;
        setEvents((previous) => [line, ...previous].slice(0, 12));
      };
      instance.on(name, handler);
      return [name, handler] as const;
    });

    return () => {
      for (const [name, handler] of handlers) instance.off(name, handler);
      instance.destroy();
      playerRef.current = null;
    };
  }, [sdkReady, session?.embedUrl]);

  const loadManualToken = () => {
    const value = tokenInput.trim();
    if (!value) return;
    const embedUrl = /^https?:\/\//i.test(value)
      ? value
      : `/embed/movie/550?token=${encodeURIComponent(value)}`;
    setSession({ embedUrl });
    setError('');
    setStatus('ready');
  };

  const command = (action: (player: PeakEmbedInstance) => void) => {
    const player = playerRef.current;
    if (player) action(player);
  };

  return (
    <div className="embed-demo-shell">
      <header className="embed-demo-header">
        <div>
          <p className="embed-demo-kicker">Peak Embed</p>
          <h1>Signed player, partner controls.</h1>
          <p>
            This page runs the public SDK against a short-lived embed token. The iframe is the
            custom Peak player; no upstream provider URL is exposed to the parent page.
          </p>
        </div>
        <span className="embed-demo-status">
          {status === 'ready'
            ? `Session ready${session?.partner ? ` · ${session.partner.name}` : ''}`
            : status === 'loading'
              ? 'Creating a demo session…'
              : 'Demo token needed'}
        </span>
      </header>

      {error && <p className="embed-demo-error">{error}</p>}

      <div className="embed-demo-grid">
        <div className="embed-demo-frame" ref={mountRef} />

        <div className="embed-demo-panel">
          <section className="embed-demo-card">
            <h2>Load a token</h2>
            <p>
              Paste an embed URL or a token from <code>POST /api/v1/embed/sessions</code>. A bare
              token loads the demo movie.
            </p>
            <div className="embed-demo-form">
              <input
                aria-label="Embed URL or token"
                placeholder="Embed URL or token"
                value={tokenInput}
                onChange={(event) => setTokenInput(event.target.value)}
              />
              <button type="button" onClick={loadManualToken}>
                Load
              </button>
            </div>
          </section>

          <section className="embed-demo-card">
            <h2>Commands</h2>
            <div className="embed-demo-actions">
              <button type="button" onClick={() => command((player) => player.play())}>
                Play
              </button>
              <button type="button" onClick={() => command((player) => player.pause())}>
                Pause
              </button>
              <button type="button" onClick={() => command((player) => player.seek(30))}>
                Seek 30s
              </button>
              <button type="button" onClick={() => command((player) => player.setVolume(0.5))}>
                Volume 50%
              </button>
              <button type="button" onClick={() => command((player) => player.setSubtitle(-1))}>
                Subtitles off
              </button>
              <button type="button" onClick={() => command((player) => player.setQuality('auto'))}>
                Auto quality
              </button>
            </div>
          </section>

          <section className="embed-demo-card">
            <h2>Events</h2>
            {events.length === 0 ? (
              <p>Waiting for the player to post its first event.</p>
            ) : (
              <ul className="embed-demo-events">
                {events.map((event, index) => (
                  <li key={`${event}-${index}`}>{event}</li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <section className="embed-demo-card" style={{ marginTop: 22 }}>
        <h2>Mount it yourself</h2>
        <pre className="embed-demo-code">{`<div id="peak-player"></div>
<script src="https://your-player.example/peak-embed.js"></script>
<script>
  const player = PeakEmbed.mount({
    target: '#peak-player',
    url: 'https://your-player.example/embed/movie/550?token=…',
  });
  player.on('ready', () => console.log('ready'));
  player.play();
</script>`}</pre>
      </section>
    </div>
  );
}
