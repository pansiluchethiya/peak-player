import type { ComponentProps } from 'react';

import { SeekIndicator } from '@/components/player/videojs/ui/seek-indicator';
import { StatusAnnouncer } from '@/components/player/videojs/ui/status-announcer';
import { PlaybackStatusIndicator, StatusIndicator } from '@/components/player/videojs/ui/status-indicator';
import { VolumeIndicator } from '@/components/player/videojs/ui/volume-indicator';
import { cn } from '@/components/player/videojs/lib/resolve-class-name';

export type VideoStatusIndicatorsProps = Omit<ComponentProps<'div'>, 'children'>;

export function VideoStatusIndicators({ className, ...props }: VideoStatusIndicatorsProps = {}) {
  return (
    <>
      <StatusAnnouncer />
      <div
        className={cn(
          'pointer-events-none absolute inset-0 z-20 grid grid-cols-3 items-center justify-items-center',
          'text-media-controls-foreground',
          className
        )}
        {...props}
      >
        <VolumeIndicator />
        <StatusIndicator />
        <SeekIndicator />
        <PlaybackStatusIndicator />
      </div>
    </>
  );
}
