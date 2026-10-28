'use client';

import '../styles/video/base.css';
import type { ComponentProps, ReactNode } from 'react';

import { BufferingIndicator } from '@/components/player/videojs/ui/buffering-indicator';
import { Container } from '@/components/player/videojs/ui/container';
import { Poster } from '@/components/player/videojs/ui/poster';
import { cn } from '@/components/player/videojs/lib/resolve-class-name';

import { VideoGestures } from './behaviors/gestures';
import { VideoHotkeys } from './behaviors/hotkeys';
import { VideoStatusIndicators } from './display/status-indicators';

export interface VideoSkinProps extends Omit<NonNullable<ComponentProps<typeof Container>>, 'children'> {
  children?: ReactNode;
  chromeInert?: boolean;
  renderPoster?: NonNullable<ComponentProps<typeof Poster>>['renderImage'];
}

export function VideoSkin({
  children,
  className,
  chromeInert = false,
  renderPoster,
  ...props
}: VideoSkinProps = {}) {
  return (
    <Container
      className={cn('pointer-fine:not-data-controls-visible:cursor-none', className)}
      data-theme="default"
      data-preset="video"
      {...props}
    >
      {children}
      <div
        className={chromeInert ? 'absolute inset-0 z-20 pointer-events-none' : 'contents'}
        inert={chromeInert}
        aria-hidden={chromeInert || undefined}
      >
        <Poster renderImage={renderPoster} />
        <BufferingIndicator />

        <VideoHotkeys />
        <VideoGestures />
        <VideoStatusIndicators />
      </div>
    </Container>
  );
}
