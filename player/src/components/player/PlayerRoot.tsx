'use client';

import { useMedia } from '@videojs/react';
import { useCallback, useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { AmbientBackground } from '../AmbientBackground';
import { ErrorState } from '../ErrorState';
import { LoadingSkeleton } from '../LoadingSkeleton';
import type { EmbedConfig, Media } from '../../lib/types';
import {
  EnginePlayer,
  PlayerProvider,
  usePlayerApi,
  usePlayerContext,
} from './PlayerProvider';
import { MediaSurface } from './media/MediaSurface';
import { engineSource } from './media/source';
import { useMediaEngine } from './media/useMediaEngine';
import { VideoSkin } from './VideoSkin';

export type PlayerPreset = 'video' | 'live-video' | 'bg';

export interface PlayerRootProps {
  apiBase: string;
  media: Media;
  embed?: EmbedConfig;
  preset?: PlayerPreset;
  poster?: string;
}

/** English-only for now; Task 6 moves every string into `i18n/messages.en.ts`. */
const MESSAGES = {
  fetchingSources: 'Fetching sources…',
  loadingChannel: 'Loading channel…',
  preparingStream: 'Preparing stream…',
  errorTitle: 'Stream unavailable',
  embedUnavailable: 'This stream is unavailable in the embedded player.',
  errorFallback: 'Something went wrong while loading this title.',
};

/**
 * The one player every route and embed mounts. It owns discovery through
 * `PlayerProvider`, creates the single `@videojs/react` engine, and renders the
 * media surface plus the vendored AMOLED skin.
 */
export function PlayerRoot({ apiBase, media, embed, preset = 'video', poster }: PlayerRootProps) {
  return (
    <PlayerProvider apiBase={apiBase} media={media} embed={embed} preset={preset}>
      <PlayerSurface media={media} embed={embed} preset={preset} poster={poster} />
    </PlayerProvider>
  );
}

interface PlayerSurfaceProps {
  media: Media;
  embed?: EmbedConfig;
  preset: PlayerPreset;
  poster?: string;
}

function PlayerSurface({ media, embed, preset, poster }: PlayerSurfaceProps) {
  const {
    api,
    branding,
    currentSourceIndex,
    payload,
    mediaMetadata,
    preferences,
    status,
    error,
    reload,
    sourceNonce,
    subtitles,
    tryNextSource,
  } = usePlayerContext();

  const source = payload?.sources[currentSourceIndex] ?? null;
  const engine = useMemo(
    () => (source ? engineSource(source, media) : null),
    [media, source],
  );
  const isExternal = engine?.kind === 'external';

  const title = mediaMetadata?.title
    ? `${mediaMetadata.title}${mediaMetadata.year ? ` (${mediaMetadata.year})` : ''}`
    : undefined;
  const posterUrl = poster ?? media.poster ?? payload?.logo ?? undefined;
  const loadingLabel = source
    ? MESSAGES.preparingStream
    : media.type === 'live_tv'
      ? MESSAGES.loadingChannel
      : MESSAGES.fetchingSources;
  const errorMessage = embed
    ? MESSAGES.embedUnavailable
    : error ?? MESSAGES.errorFallback;

  // One failover attempt per source generation; `tryNextSource` only sets the
  // error state once every source has been exhausted.
  const failedSourceRef = useRef<string | null>(null);
  const handleMediaError = useCallback(() => {
    const token = `${currentSourceIndex}:${sourceNonce}`;
    if (failedSourceRef.current === token) return;
    failedSourceRef.current = token;
    tryNextSource();
  }, [currentSourceIndex, sourceNonce, tryNextSource]);

  const handleEnded = useCallback(() => {
    if (media.type === 'tv' && preferences.autoplayNext) {
      api.nextEpisode().catch(() => undefined);
    }
  }, [api, media.type, preferences.autoplayNext]);

  return (
    <div
      className={`player-root player-preset-${preset}`}
      style={{ '--accent': branding.accentColor } as CSSProperties}
    >
      <AmbientBackground accentColor={branding.accentColor} />

      {preset === 'bg' ? (
        <div className="player-stage player-stage-bg" aria-hidden="true">
          <EnginePlayer title={title} poster={posterUrl}>
            <EngineBridge autoPlay={false} />
            <MediaSurface
              key={sourceNonce}
              media={media}
              source={source}
              title={title}
              autoPlay
              muted
              loop
              controls={false}
              playsInline
              onMediaError={handleMediaError}
            />
          </EnginePlayer>
        </div>
      ) : (
        <div
          className="player-stage player-stage-video"
          data-transport={isExternal ? 'external' : undefined}
        >
          <EnginePlayer title={title} poster={posterUrl}>
            <EngineBridge autoPlay={preferences.autoplay} />
            <VideoSkin chromeInert={isExternal}>
              <MediaSurface
                key={sourceNonce}
                media={media}
                source={source}
                title={title}
                autoPlay={preferences.autoplay}
                muted={preferences.muted}
                controls={false}
                playsInline
                subtitles={subtitles}
                onMediaError={handleMediaError}
                onEnded={handleEnded}
              />
            </VideoSkin>
          </EnginePlayer>

          {status === 'loading' && (
            <LoadingSkeleton
              branding={branding}
              poster={poster ?? media.poster ?? payload?.logo}
              label={loadingLabel}
            />
          )}

          {status === 'error' && (
            <ErrorState
              title={MESSAGES.errorTitle}
              message={errorMessage}
              diagnostics={embed ? undefined : payload?.diagnostics}
              onTryAnother={tryNextSource}
              onReload={() => reload(true)}
            />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Lives inside `EnginePlayer` so it can reach the typed store, and registers the
 * imperative handle the provider's `PlayerApi` awaits.
 */
function EngineBridge({ autoPlay }: { autoPlay: boolean }) {
  const { currentSourceIndex, registerEngine, sourceNonce, status } = usePlayerContext();
  useMediaEngine(registerEngine);
  const media = useMedia();
  const api = usePlayerApi();
  const playedRef = useRef<string | null>(null);

  // The media element attaches a commit before this effect runs, so this is the
  // first point where `handle.play()` is legal. One attempt per source generation
  // keeps a user pause from being undone by an unrelated re-render.
  useEffect(() => {
    if (!autoPlay || !media || status !== 'ready') return;
    const token = `${currentSourceIndex}:${sourceNonce}`;
    if (playedRef.current === token) return;
    playedRef.current = token;
    api.play().catch(() => undefined);
  }, [api, autoPlay, currentSourceIndex, media, sourceNonce, status]);

  return null;
}
