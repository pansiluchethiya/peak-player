'use client';

import type { MediaResolution } from '@videojs/react';
import { HlsJsVideo } from '@videojs/react/media/hlsjs-video';
import { Video } from '@videojs/react/video';
import { ExternalEmbed } from '../../ExternalEmbed';
import type { Media, Source, Subtitle } from '../../../lib/types';
import { t } from '../i18n';
import { engineSource } from './source';

export interface MediaSurfaceProps {
  media: Media;
  source: Source | null;
  title?: string;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  controls?: boolean;
  playsInline?: boolean;
  className?: string;
  subtitles?: Subtitle[];
  /** Ceiling for HLS ABR; `undefined` leaves the ladder uncapped. */
  maxResolution?: MediaResolution;
  onMediaError?: () => void;
  onEnded?: () => void;
}

const MEDIA_CLASS = 'player-video';

/**
 * The single media element every surface renders. The backend source decides
 * which engine plays it: `HlsJsVideo` for adaptive streams, the native `Video`
 * element for progressive files, and the external iframe shell for providers
 * that cannot be played in-page.
 */
export function MediaSurface({
  media,
  source,
  title,
  autoPlay = false,
  muted = false,
  loop = false,
  controls = false,
  playsInline = true,
  className = MEDIA_CLASS,
  subtitles,
  maxResolution,
  onMediaError,
  onEnded,
}: MediaSurfaceProps) {
  if (!source?.url) return null;

  const engine = engineSource(source, media);
  const subtitleTracks = subtitles
    ?.filter((subtitle) => Boolean(subtitle.url))
    .map((subtitle, index) => (
      <track
        key={`${subtitle.url}-${index}`}
        kind="subtitles"
        src={subtitle.url}
        srcLang={subtitle.lang}
        label={subtitle.label}
      />
    ));

  if (engine.kind === 'external') {
    return (
      <ExternalEmbed
        url={engine.src}
        title={title ? `${title} — ${t('external-provider')}` : t('external-player')}
      />
    );
  }

  if (engine.kind === 'hls') {
    return (
      <HlsJsVideo
        className={className}
        source={{
          src: engine.src,
          type: 'application/vnd.apple.mpegurl',
          maxAutoResolution: maxResolution,
        }}
        streamType={engine.streamType}
        autoPlay={autoPlay}
        muted={muted}
        loop={loop}
        controls={controls}
        playsInline={playsInline}
        crossOrigin="anonymous"
        preload="auto"
        onError={onMediaError}
        onEnded={onEnded}
      >
        {subtitleTracks}
      </HlsJsVideo>
    );
  }

  return (
    <Video
      className={className}
      src={engine.src}
      autoPlay={autoPlay}
      muted={muted}
      loop={loop}
      controls={controls}
      playsInline={playsInline}
      crossOrigin="anonymous"
      preload="auto"
      onError={onMediaError}
      onEnded={onEnded}
    >
      {subtitleTracks}
    </Video>
  );
}
