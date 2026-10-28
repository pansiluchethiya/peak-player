'use client';
import { useEffect, useState } from 'react';
import { Captions, CaptionsOff } from 'lucide-react';
import { usePlayerContext } from '../PlayerProvider';
import { t } from '../i18n';
import { CaptionsOverlay } from '../overlays/CaptionsOverlay';
import { ControlButton } from './ControlButton';
import { PlayButton } from './PlayButton';
import { Scrubber } from './Scrubber';
import { TimeDisplay, TotalTime } from './TimeDisplay';
import { VolumeControl } from './VolumeControl';
import { FullscreenButton, PipButton, CastButton } from './FullscreenButton';
import { EpisodeNav } from './EpisodeNav';
import { SettingsMenu } from './SettingsMenu';
import { ShortcutsHelp } from '../overlays/ShortcutsHelp';
import { StatsOverlay } from '../overlays/StatsOverlay';
import { UpNextOverlay } from '../overlays/UpNextOverlay';

type Props = { subtitles: { url: string; lang: string; label: string }[] };

/**
 * Transport chrome. The timeline owns a full-bleed row above the buttons so the
 * progress rail spans the whole player and every control sits underneath it.
 */
export function ControlBar({ subtitles }: Props) {
  const { api, preferences } = usePlayerContext();
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showStats, setShowStats] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '?') setShowShortcuts((v) => !v);
      if (e.key === 'g') setShowStats((v) => !v);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // The custom context menu and the stats hotkey both open the same overlay.
  useEffect(() => {
    const handler = () => setShowStats((value) => !value);
    window.addEventListener('peak-toggle-stats', handler);
    return () => window.removeEventListener('peak-toggle-stats', handler);
  }, []);

  const captionTrack =
    subtitles.find((track) => track.label === preferences.captions.language) ??
    subtitles.find((track) => track.lang === preferences.captions.language) ??
    subtitles[0];

  return (
    <>
      {showShortcuts ? <ShortcutsHelp onClose={() => setShowShortcuts(false)} /> : null}
      {showStats ? <StatsOverlay onClose={() => setShowStats(false)} /> : null}
      <UpNextOverlay />
      <CaptionsOverlay
        src={captionTrack?.url ?? ''}
        language={captionTrack?.lang}
        label={captionTrack?.label}
      />
      <nav className="peak-control-bar" aria-label="Controls">
        <div className="peak-progress-row">
          <Scrubber />
        </div>
        <div className="peak-controls-row">
          <div className="peak-control-group start">
            <PlayButton />
            <VolumeControl boost={preferences.boost} />
            <TimeDisplay />
          </div>
          <div className="peak-control-group end">
            <TotalTime />
            <EpisodeNav direction="previous" />
            <EpisodeNav direction="next" />
            <ControlButton
              aria-label={preferences.captions.enabled ? t('captions-disable') : t('captions-enable')}
              aria-pressed={preferences.captions.enabled}
              icon={preferences.captions.enabled ? <Captions size={18} /> : <CaptionsOff size={18} />}
              onClick={() =>
                api.setCaptions({ enabled: !preferences.captions.enabled }).catch(() => undefined)
              }
            />
            <SettingsMenu />
            <PipButton />
            <CastButton />
            <FullscreenButton />
          </div>
        </div>
      </nav>
    </>
  );
}
