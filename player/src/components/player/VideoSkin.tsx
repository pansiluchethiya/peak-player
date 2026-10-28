import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { VideoSkin as VendoredVideoSkin } from './videojs/video/skin';

export interface PeakVideoSkinProps {
  children: ReactNode;
  className?: string;
  /** External providers own transport: keep the iframe usable but disable the chrome. */
  chromeInert?: boolean;
}

export function VideoSkin({ children, className, chromeInert }: PeakVideoSkinProps) {
  return (
    <VendoredVideoSkin className={cn('peak-video-skin', className)} chromeInert={chromeInert}>
      {children}
    </VendoredVideoSkin>
  );
}
