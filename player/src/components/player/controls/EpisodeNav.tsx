'use client';
import { SkipBack, SkipForward } from 'lucide-react';
import { usePlayerContext } from '../PlayerProvider';
import { ControlButton } from './ControlButton';

interface EpisodeNavProps {
  direction: 'next' | 'previous';
}

/** Next/previous episode buttons exist only for series (spec §12). */
export function EpisodeNav({ direction }: EpisodeNavProps) {
  const { api, media } = usePlayerContext();
  if (media.type !== 'tv') return null;
  const isNext = direction === 'next';
  return (
    <ControlButton
      aria-label={isNext ? 'Next episode' : 'Previous episode'}
      icon={isNext ? <SkipForward size={17} /> : <SkipBack size={17} />}
      onClick={() => (isNext ? api.nextEpisode() : api.previousEpisode()).catch(() => undefined)}
    />
  );
}
