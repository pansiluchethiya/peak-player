import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { VideoSkin as VendoredVideoSkin } from './videojs/video/skin';

export interface PeakVideoSkinProps {
  children: ReactNode;
  className?: string;
}

export function VideoSkin({ children, className }: PeakVideoSkinProps) {
  return (
    <VendoredVideoSkin className={cn('peak-video-skin', className)}>
      {children}
    </VendoredVideoSkin>
  );
}
