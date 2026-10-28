import type { CSSProperties, ReactNode } from 'react';

interface Props {
  label: string;
  /** Kept for the ambient artwork behind the spinner when it is available. */
  backdrop?: string | null;
  children?: ReactNode;
}

/**
 * YouTube-style discovery state: a black stage with one round spinner. The
 * old skeleton (poster, progress bar, tagline) read as a second landing page,
 * so nothing but the spinner is visible while sources are resolved.
 */
export function LoadingSpinner({ label, backdrop, children }: Props) {
  const tmdbBackdrop = backdrop && backdrop.startsWith('/') ? `https://image.tmdb.org/t/p/original${backdrop}` : backdrop;

  const style: CSSProperties = tmdbBackdrop
    ? {
        backgroundImage: `linear-gradient(rgb(0 0 0 / 72%), rgb(0 0 0 / 88%)), url(${tmdbBackdrop})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : {};

  return (
    <div className="peak-loading" role="status" aria-live="polite" aria-label={label} style={style}>
      {children}
      <svg className="peak-spinner" viewBox="0 0 50 50" width="46" height="46" aria-hidden="true">
        <circle className="peak-spinner-track" cx="25" cy="25" r="20" fill="none" strokeWidth="3.5" />
        <circle className="peak-spinner-arc" cx="25" cy="25" r="20" fill="none" strokeWidth="3.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}
