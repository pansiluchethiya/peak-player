'use client';
import { usePlayerContext } from '../PlayerProvider';
import { ControlButton } from './ControlButton';

interface EpisodeNavProps {
  direction: 'next' | 'previous';
}

/** Next/previous episode buttons for TV (spec §12). */
export function EpisodeNav({ direction }: EpisodeNavProps) {
  const { api, media } = usePlayerContext();
  const isNext = direction === 'next';
  const disabled = media.type !== 'tv';
  return (
    <ControlButton
      aria-label={isNext ? 'Next episode' : 'Previous episode'}
      icon={isNext ? '⏭' : '⏮'}
      disabled={disabled}
      onClick={() => (isNext ? api.nextEpisode() : api.previousEpisode()).catch(() => undefined)}
    />
  );
}
