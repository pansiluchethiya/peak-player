'use client';
import { useEffect, useRef, useState } from 'react';
import { usePlayerContext } from '../PlayerProvider';
import { activeCues, type VttCue } from '../../../lib/webvtt';
import type { CaptionPreferences } from '../prefs/schema';

interface CaptionsOverlayProps {
  src: string;
  kind?: 'subtitles' | 'captions';
  label?: string;
  language?: string;
}

function loadCues(src: string): Promise<VttCue[]> {
  if (!src) return Promise.resolve([]);
  return import('../../../lib/webvtt').then(({ parseSubtitles }) =>
    fetch(src)
      .then((r) => (r.ok ? r.text() : ''))
      .then((text) => parseSubtitles(text))
      .catch(() => []),
  );
}

/** Renders mica-backed captions from a WebVTT source; disables native cue rendering. */
export function CaptionsOverlay({ src, kind = 'subtitles', label, language }: CaptionsOverlayProps) {
  const { preferences } = usePlayerContext();
  const [cues, setCues] = useState<VttCue[]>([]);
  const [time, setTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadCues(src).then((parsed) => {
      if (!cancelled) setCues(parsed);
    });
    return () => { cancelled = true; };
  }, [src]);

  useEffect(() => {
    const video = document.querySelector('video') as HTMLVideoElement | null;
    if (!video) return;
    videoRef.current = video;
    for (let i = 0; i < video.textTracks.length; i += 1) {
      video.textTracks[i].mode = 'disabled';
    }
    let frame = 0;
    const tick = () => { setTime(video.currentTime); frame = requestAnimationFrame(tick); };
    tick();
    return () => cancelAnimationFrame(frame);
  }, []);

  const settings: CaptionPreferences = preferences.captions;
  const adjustedTime = time + settings.offset;
  const active = cues.filter((c) => c.start <= adjustedTime && adjustedTime < c.end);
  if (!settings.enabled || !active.length) return null;

  return (
    <div
      className="captions-mica"
      data-mica={settings.mica}
      data-size={settings.size}
      data-edge={settings.edge}
      style={{ opacity: settings.opacity, color: settings.mica ? '#fff' : '#e5e5e5' }}
    >
      {active.map((c, i) => (
        <span key={`${c.start}-${i}`}>{c.text}</span>
      ))}
    </div>
  );
}
