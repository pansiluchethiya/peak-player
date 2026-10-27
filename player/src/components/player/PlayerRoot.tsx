'use client';

import { useCallback, useMemo, useRef, type CSSProperties } from 'react';
import { AmbientBackground } from '../AmbientBackground';
import { ErrorState } from '../ErrorState';
import { LoadingSkeleton } from '../LoadingSkeleton';
import { nextSourceIndex, sourceKey } from '../../lib/playback';
import { autoplayPolicy } from '../../lib/presentation';
import type { EmbedConfig, Media } from '../../lib/types';
import { Breadcrumb } from './controls/Breadcrumb';
import { Header } from './Header';
import { t } from './i18n';
import { MuxAnalytics, muxEnabled } from './media/MuxAnalytics';
import { MediaSurface } from './media/MediaSurface';
import { engineSource } from './media/source';
import { useMediaEngine } from './media/useMediaEngine';
import { PosterOverlay } from './overlays/PosterOverlay';
import {
  EnginePlayer,
  PlayerProvider,
  usePlayerContext,
} from './PlayerProvider';
import { VideoSkin } from './VideoSkin';

export type PlayerPreset = 'video' | 'live-video' | 'bg';

export interface PlayerRootProps {
  apiBase: string;
  media: Media;
  embed?: EmbedConfig;
  preset?: PlayerPreset;
  poster?: string;
}

/**
 * The one player every route and embed mounts. It owns discovery through
 * `PlayerProvider`, creates the single `@videojs/react` engine, and renders the
 * media surface plus the vendored AMOLED skin and Peak chrome.
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
    sources,
    subtitles,
    tryNextSource,
  } = usePlayerContext();

  const source = payload?.sources[currentSourceIndex] ?? null;
  const engine = useMemo(
    () => (source ? engineSource(source, media) : null),
    [media, source],
  );
  const isExternal = engine?.kind === 'external';
  const policy = preset === 'bg' ? { shouldPlay: true, muted: true } : autoplayPolicy(preferences);

  const title = mediaMetadata?.title?.trim() || undefined;
  const posterCandidates = [poster, media.poster, mediaMetadata?.logo, payload?.logo].filter(
    (candidate): candidate is string => typeof candidate === 'string' && candidate.length > 0,
  );
  const posterUrl = posterCandidates[0];
  const description = mediaMetadata?.overview ?? t('no-description');

  const loadingLabel = source
    ? t('preparing-stream')
    : media.type === 'live_tv'
      ? t('loading-channel')
      : t('fetching-sources');
  const errorMessage = embed ? t('embed-unavailable') : error ?? t('error-fallback');

  // One failover attempt per source generation; `tryNextSource` only sets the
  // terminal error once every source has been exhausted.
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

  // "Try another" advances to the next untried source when one exists; when all
  // sources are exhausted (or discovery found none) it restarts discovery so the
  // button always produces visible progress instead of dead-ending.
  const handleTryAnother = useCallback(() => {
    const current = Math.min(Math.max(currentSourceIndex, 0), Math.max(sources.length - 1, 0));
    const attempted = new Set<string>();
    for (let index = 0; index <= current; index += 1) {
      attempted.add(sourceKey(sources[index], index));
    }
    if (nextSourceIndex(sources, current, attempted) >= 0) {
      tryNextSource();
    } else {
      reload(true);
    }
  }, [currentSourceIndex, reload, sources, tryNextSource]);

  return (
    <div
      className={`player-root player-preset-${preset}`}
      style={{ '--accent': branding.accentColor } as CSSProperties}
    >
      <AmbientBackground accentColor={branding.accentColor} />

      {preset === 'bg' ? (
        <div className="player-stage player-stage-bg" aria-hidden="true">
          <EnginePlayer title={title} poster={posterUrl}>
            <EngineBridge />
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
            <EngineBridge />
            {muxEnabled ? <MuxAnalytics /> : null}
            <VideoSkin chromeInert={isExternal}>
              <MediaSurface
                key={sourceNonce}
                media={media}
                source={source}
                title={title}
                autoPlay={policy.shouldPlay}
                muted={policy.muted}
                controls={false}
                playsInline
                subtitles={subtitles}
                onMediaError={handleMediaError}
                onEnded={handleEnded}
              />
            </VideoSkin>
            {!isExternal ? (
              <PosterOverlay poster={posterUrl} title={title} description={description} />
            ) : null}
          </EnginePlayer>

          <Header
            title={title}
            year={mediaMetadata?.year}
            runtime={mediaMetadata?.runtime}
            quality={source?.quality}
            locale={preferences.locale}
          />
          <Breadcrumb type={media.type} title={title} embed={Boolean(embed)} />

          {status === 'loading' && (
            <LoadingSkeleton
              branding={branding}
              poster={poster ?? media.poster ?? payload?.logo}
              label={loadingLabel}
            />
          )}

          {status === 'error' && (
            <ErrorState
              title={t('error-title')}
              message={errorMessage}
              diagnostics={embed ? undefined : payload?.diagnostics}
              onTryAnother={handleTryAnother}
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
 * imperative handle the provider's `PlayerApi` awaits. Autoplay itself belongs
 * to `PlayerProvider`, which applies `autoplayPolicy` once the handle is ready.
 */
function EngineBridge() {
  const { registerEngine } = usePlayerContext();
  useMediaEngine(registerEngine);
  return null;
}
