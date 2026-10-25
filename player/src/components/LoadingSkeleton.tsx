import type { Branding } from '../lib/types';

interface Props {
  branding: Branding;
  label: string;
  poster?: string | null;
  backdrop?: string | null;
}

export function LoadingSkeleton({ branding, label, poster, backdrop }: Props) {
  const tmdbImg = poster && poster.startsWith('/') ? `https://image.tmdb.org/t/p/w500${poster}` : poster;
  const tmdbBackdrop = backdrop && backdrop.startsWith('/') ? `https://image.tmdb.org/t/p/original${backdrop}` : backdrop;

  const bgStyle: React.CSSProperties = tmdbBackdrop
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
        {tmdbImg ? (
          <img className="loading-poster" src={tmdbImg} alt="" loading="lazy" />
        ) : (
          <img className="loading-logo" src={branding.logoUrl} alt="" />
        )}
        <div className="loading-bar">
          <span className="loading-bar-fill" />
        </div>
        <p className="loading-label">{label}</p>
        <p className="loading-brand">{branding.tagline}</p>
      </div>
    </div>
  );
}
