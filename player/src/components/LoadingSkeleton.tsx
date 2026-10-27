import type { CSSProperties, ReactNode } from 'react';
import type { Branding } from '../lib/types';

interface Props {
  branding: Branding;
  label: string;
  /** Resolved artwork from `ArtworkChain`; falls back to the brand logo. */
  artwork?: ReactNode;
  backdrop?: string | null;
}

export function LoadingSkeleton({ branding, label, artwork, backdrop }: Props) {
  const tmdbBackdrop = backdrop && backdrop.startsWith('/') ? `https://image.tmdb.org/t/p/original${backdrop}` : backdrop;

  const bgStyle: CSSProperties = tmdbBackdrop
    ? {
        backgroundImage: `url(${tmdbBackdrop})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }
    : {};

  return (
    <div className="loading-layer" role="status" aria-live="polite" style={bgStyle}>
      {tmdbBackdrop && <div className="loading-backdrop-overlay" />}
      <div className="loading-glow" />
      <div className="loading-inner">
        {artwork ?? <img className="loading-logo" src={branding.logoUrl} alt="" />}
        <div className="loading-bar">
          <span className="loading-bar-fill" />
        </div>
        <p className="loading-label">{label}</p>
        <p className="loading-brand">{branding.tagline}</p>
      </div>
    </div>
  );
}
