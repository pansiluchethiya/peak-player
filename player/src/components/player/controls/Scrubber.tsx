'use client';
import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { usePlayerContext } from '../PlayerProvider';
import { useScrubberThumbnails } from '../media/useScrubberThumbnails';
import { useThumbnailVtt } from '../media/useThumbnailVtt';
import { thumbnailCueAt } from '../../../lib/thumbnails';
import { formatTimecode } from './TimeDisplay';

interface HoverState {
  time: number;
  x: number;
  width: number;
}

/**
 * Live-aware timeline. A custom rail replaces the native range input so the
 * bar can be thicker, show buffered progress, and preview frames on hover.
 */
export function Scrubber() {
  const { api, payload, currentSourceIndex } = usePlayerContext();
  const [state, setState] = useState(() => api.getState());
  const [hover, setHover] = useState<HoverState | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);

  const source = payload?.sources[currentSourceIndex] ?? null;
  const spriteUrl = source?.thumbnailVtt ?? null;
  const spriteVtt = useThumbnailVtt(spriteUrl);
  const { frames, requestFrame } = useScrubberThumbnails(source, !spriteUrl);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      setState(api.getState());
      frame = window.requestAnimationFrame(tick);
    };
    tick();
    return () => window.cancelAnimationFrame(frame);
  }, [api]);

  const live = state.live;
  const hasDvr = live && Number.isFinite(state.liveEdgeStart) && Number.isFinite(state.targetLiveWindow);
  const max = hasDvr ? state.liveEdgeStart : state.duration;
  const min = hasDvr ? Math.max(0, state.liveEdgeStart - state.targetLiveWindow) : 0;
  const range = Math.max(max - min, 0.001);
  const value = Math.min(Math.max(state.currentTime, min), max || 0);
  const percent = Math.min(Math.max(((value - min) / range) * 100, 0), 100);
  const seekable = !live || hasDvr;

  const timeAt = (clientX: number) => {
    const rect = railRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    return { time: min + ratio * range, x: ratio * rect.width, width: rect.width };
  };

  const seek = (time: number) => {
    api.seek(time).catch(() => undefined);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!seekable) return;
    const point = timeAt(event.clientX);
    if (!point) return;
    setHover(point);
    if (scrubbing) seek(point.time);
    else if (!live) requestFrame(point.time);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!seekable) return;
    const point = timeAt(event.clientX);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setScrubbing(true);
    setHover(point);
    seek(point.time);
  };

  const endScrub = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setScrubbing(false);
  };

  let preview: string | undefined;
  let spriteCue: { url: string; x: number; y: number; width: number; height: number; start: number; end: number } | null = null;
  if (hover && spriteVtt) {
    spriteCue = thumbnailCueAt(spriteVtt, hover.time);
  }
  if (hover && !spriteCue && frames.size > 0) {
    let best = Number.POSITIVE_INFINITY;
    for (const [second, frame] of frames) {
      const distance = Math.abs(second - hover.time);
      if (distance < best) {
        best = distance;
        preview = frame;
      }
    }
    if (best > 4) preview = undefined;
  }

  return (
    <div className={`peak-scrubber${scrubbing ? ' is-scrubbing' : ''}`}>
      {hasDvr ? <span className="peak-live-range" /> : live ? <span className="peak-live-static" /> : null}
      <div
        ref={railRef}
        className="peak-scrubber-rail"
        role="slider"
        tabIndex={0}
        aria-label={live ? 'Live position' : 'Seek'}
        aria-valuemin={min}
        aria-valuemax={max || 0}
        aria-valuenow={value}
        aria-valuetext={formatTimecode(value)}
        aria-disabled={!seekable}
        onPointerMove={onPointerMove}
        onPointerDown={onPointerDown}
        onPointerUp={endScrub}
        onPointerCancel={endScrub}
        onPointerLeave={() => {
          if (!scrubbing) setHover(null);
        }}
        onKeyDown={(event) => {
          if (!seekable) return;
          if (event.key === 'ArrowLeft') {
            event.preventDefault();
            api.seekBy(-5).catch(() => undefined);
          } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            api.seekBy(5).catch(() => undefined);
          } else if (event.key === 'Home') {
            event.preventDefault();
            seek(min);
          } else if (event.key === 'End') {
            event.preventDefault();
            seek(max);
          }
        }}
      >
        <div className="peak-scrubber-track">
          <div className="peak-scrubber-fill" style={{ width: `${percent}%` }} />
          <div className="peak-scrubber-thumb" style={{ left: `${percent}%` }} />
        </div>
        {hover ? (
          <div
            className="peak-scrubber-preview"
            style={{ left: `${Math.min(Math.max(hover.x, 82), Math.max(hover.width - 82, 82))}px` }}
          >
            {spriteCue ? (
              <div
                className="peak-scrubber-sprite-frame"
                style={{
                  backgroundImage: `url(${spriteCue.url})`,
                  width: `${spriteCue.width}px`,
                  height: `${spriteCue.height}px`,
                  backgroundSize: `${spriteVtt?.spriteWidth ?? 0}px ${spriteVtt?.spriteHeight ?? 0}px`,
                  backgroundPosition: `-${spriteCue.x}px -${spriteCue.y}px`,
                }}
              />
            ) : preview ? (
              <img src={preview} alt="" width={160} height={90} />
            ) : (
              <div className="peak-scrubber-preview-empty" />
            )}
            <span>{formatTimecode(hover.time)}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
