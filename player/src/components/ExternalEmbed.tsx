'use client';

interface Props {
  url: string;
  title?: string;
}

const ALLOW_THIRD_PARTY = process.env.NEXT_PUBLIC_ALLOW_THIRD_PARTY_EMBED === '1';

export function ExternalEmbed({ url, title = 'External player' }: Props) {
  if (!ALLOW_THIRD_PARTY) {
    return (
      <div className="external-embed-disabled" role="alert">
        <strong>External provider</strong>
        <span>
          External provider playback is disabled. Set NEXT_PUBLIC_ALLOW_THIRD_PARTY_EMBED=1 to opt
          in.
        </span>
      </div>
    );
  }

  return (
    <div className="external-embed">
      <span className="external-embed-label">External provider</span>
      <iframe
        src={url}
        title={title}
        className="player-video"
        sandbox="allow-scripts allow-presentation"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        referrerPolicy="origin"
      />
    </div>
  );
}
