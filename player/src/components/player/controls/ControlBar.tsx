'use client';
import { useEffect, useState } from 'react';
import { usePlayerContext } from '../PlayerProvider';
import { CaptionsOverlay } from '../overlays/CaptionsOverlay';
import { PlayButton } from './PlayButton';
import { SeekButton, TimeDisplay } from './SeekButton';
import { Scrubber } from './Scrubber';
import { VolumeControl } from './VolumeControl';
import { FullscreenButton, PipButton, CastButton } from './FullscreenButton';
import { EpisodeNav } from './EpisodeNav';
import { SettingsMenu } from './SettingsMenu';
import { ServerMenu } from '../menus/ServerMenu';
import { QualityMenu } from '../menus/QualityMenu';
import { AudioMenu } from '../menus/AudioMenu';
import { ShortcutsHelp } from '../overlays/ShortcutsHelp';
import { StatsOverlay } from '../overlays/StatsOverlay';
import { UpNextOverlay } from '../overlays/UpNextOverlay';

type Props = { subtitles: { url: string; lang: string; label: string }[] };

export function ControlBar({ subtitles }: Props) {
  const { preferences } = usePlayerContext();
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

  return (
    <>
      {showShortcuts ? <ShortcutsHelp onClose={() => setShowShortcuts(false)} /> : null}
      {showStats ? <StatsOverlay onClose={() => setShowStats(false)} /> : null}
      <UpNextOverlay />
      <CaptionsOverlay src={subtitles[0]?.url ?? ''} language={subtitles[0]?.lang} />
      <nav className="peak-control-bar" aria-label="Controls">
        <div className="peak-control-group start">
          <PlayButton />
          <SeekButton delta={-10} label="Seek back 10s" icon="⏪" />
          <SeekButton delta={10} label="Seek forward 10s" icon="⏩" />
          <TimeDisplay />
          <Scrubber />
        </div>
        <div className="peak-control-group center">
          <VolumeControl boost={preferences.boost} />
        </div>
        <div className="peak-control-group end">
          <ServerMenu />
          <QualityMenu />
          <AudioMenu />
          <SettingsMenu />
          <EpisodeNav direction="previous" />
          <EpisodeNav direction="next" />
          <PipButton />
          <CastButton />
          <FullscreenButton />
        </div>
      </nav>
    </>
  );
}
