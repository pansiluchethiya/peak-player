import MiniPlayer from '@/components/MiniPlayer';

export default function HomePage() {
  const playerUrl = process.env.NEXT_PUBLIC_PLAYER_URL || 'http://localhost:3011';
  const mediaType = process.env.NEXT_PUBLIC_DEFAULT_MEDIA_TYPE || 'movie';
  const mediaId = process.env.NEXT_PUBLIC_DEFAULT_MEDIA_ID || '550';

  return (
    <main className="mini-shell">
      <div className="mini-inner">
        <header className="mini-head">
          <div>
            <p className="mini-eyebrow">Peak embed</p>
            <h1 className="mini-title">Mini player</h1>
            <p className="mini-sub">
              A minimal Next.js frontend. It mints a signed embed session from the Peak API and
              mounts the player automatically, so there is nothing to configure in the browser.
            </p>
          </div>
          <a className="mini-link" href={playerUrl} target="_blank" rel="noreferrer">
            Open player ↗
          </a>
        </header>

        <div className="player-frame">
          <MiniPlayer mediaType={mediaType} mediaId={mediaId} />
        </div>

        <p className="mini-foot">
          The partner API key and session token stay server-side. Playback runs in the Peak player
          iframe, scoped to this origin.
        </p>
      </div>
    </main>
  );
}
