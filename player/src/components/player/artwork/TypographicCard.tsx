'use client';

import type { CSSProperties } from 'react';
import type { MediaType } from '../../../lib/types';
import { t, type MessageKey } from '../i18n';

const TYPE_LABELS: Record<MediaType, MessageKey> = {
  movie: 'type-movie',
  tv: 'type-tv',
  live_tv: 'type-live',
};

const DEFAULT_GRADIENT = 'linear-gradient(145deg, #0b0b0b 0%, #1c1c1c 100%)';

export interface TypographicCardProps {
  title?: string | null;
  year?: number | string | null;
  type?: MediaType | null;
  /** Deterministic gradient from `artworkGradient`; falls back to flat charcoal. */
  gradient?: string;
  className?: string;
  /** Paint the bundled monochrome card art behind the gradient (step 8). */
  backgroundArt?: boolean;
}

/**
 * The chain's step 7: title, year and type on a hash-derived gradient. Pure
 * DOM and zero remote requests; the bundled SVG is only ever a CSS background.
 */
export function TypographicCard({
  title,
  year,
  type,
  gradient,
  className,
  backgroundArt = false,
}: TypographicCardProps) {
  const safeTitle = typeof title === 'string' && title.trim() ? title.trim() : t('untitled');
  const typeLabel = type ? t(TYPE_LABELS[type]) : null;
  const showMeta = Boolean(typeLabel || year);
  const classes = ['peak-artwork-card', backgroundArt ? 'has-fallback-art' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classes}
      style={{ background: gradient || DEFAULT_GRADIENT } as CSSProperties}
      role="img"
      aria-label={safeTitle}
    >
      <svg
        className="peak-artwork-card-mark"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M2.2 20 9.1 6.4a1 1 0 0 1 1.8 0l3.1 6 2.1-3.6a1 1 0 0 1 1.7 0L23.8 20H2.2Z"
          fill="currentColor"
        />
      </svg>
      <div className="peak-artwork-card-copy">
        <p className="peak-artwork-card-title">{safeTitle}</p>
        {showMeta ? (
          <p className="peak-artwork-card-meta">
            {typeLabel}
            {typeLabel && year ? <span aria-hidden="true"> · </span> : null}
            {year ? <span>{year}</span> : null}
          </p>
        ) : null}
      </div>
    </div>
  );
}
