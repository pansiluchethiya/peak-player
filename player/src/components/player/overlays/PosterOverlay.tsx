'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { pausedPosterVisible } from '../../../lib/presentation';
import { t } from '../i18n';
import { usePlayerContext } from '../PlayerProvider';

export interface PosterOverlayProps {
  /** Resolved artwork from `ArtworkChain` (falls back to the typographic card). */
  artwork?: ReactNode;
  title?: string;
  description?: string;
}

/**
 * One overlay, two roles (spec §6.1): a full pre-play card and a translucent
 * card 800 ms after pause. Playback state comes from the engine store because
 * the overlay renders inside `EnginePlayer`.
 */
export function PosterOverlay({ artwork, title, description }: PosterOverlayProps) {
  const { api, needsInteraction, status, useEnginePlayer } = usePlayerContext();
  const paused = useEnginePlayer((state) => state.paused);
  const currentTime = useEnginePlayer((state) => state.currentTime);

  const [hasPlayed, setHasPlayed] = useState(false);
  const [pausedForMs, setPausedForMs] = useState(0);

  useEffect(() => {
    if (currentTime > 0) setHasPlayed(true);
  }, [currentTime]);

  useEffect(() => {
    if (!paused || !hasPlayed) {
      setPausedForMs(0);
      return;
    }
    const timer = window.setTimeout(() => setPausedForMs(800), 800);
    return () => window.clearTimeout(timer);
  }, [hasPlayed, paused]);

  const play = useCallback(() => {
    api.play().catch(() => undefined);
  }, [api]);

  const unmute = useCallback(async () => {
    try {
      await api.setMuted(false);
      await api.play();
    } catch {
      // The chip is best-effort; the browser may still require another gesture.
    }
  }, [api]);

  // During discovery/loading the card must not cover the skeleton; it only
  // becomes the pre-play affordance once a source is ready.
  const prePlay = !hasPlayed && status === 'ready';
  const pausedCard = !prePlay && paused && pausedPosterVisible(pausedForMs, hasPlayed);
  const visible = status !== 'error' && (prePlay || pausedCard);

  if (!visible && !needsInteraction) return null;

  return (
    <div className={`peak-poster-overlay ${pausedCard ? 'is-paused' : 'is-preplay'}`}>
      {visible ? (
        <div
          className="peak-poster-card"
          role="button"
          tabIndex={0}
          aria-label={t('play')}
          onClick={play}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              play();
            }
          }}
        >
          {artwork}
          <div className="peak-poster-copy">
            {title ? <p className="peak-poster-title">{title}</p> : null}
            {description ? <p className="peak-poster-description">{description}</p> : null}
            <span className="peak-poster-play" aria-hidden="true">
              {t('play')}
            </span>
          </div>
        </div>
      ) : null}

      {needsInteraction ? (
        <button
          type="button"
          className="peak-unmute-chip"
          onClick={(event) => {
            event.stopPropagation();
            void unmute();
          }}
        >
          {t('tap-to-unmute')}
        </button>
      ) : null}
    </div>
  );
}
