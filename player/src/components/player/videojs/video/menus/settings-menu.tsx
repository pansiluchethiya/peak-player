import type { ComponentProps } from 'react';

import { AudioTrackMenu } from '@/components/player/videojs/ui/audio-track-menu';
import { CaptionsSubmenu } from '@/components/player/videojs/ui/captions-submenu';
import { PlaybackRateSubmenu } from '@/components/player/videojs/ui/playback-rate-submenu';
import { QualityMenu } from '@/components/player/videojs/ui/quality-menu';
import { SettingsMenu } from '@/components/player/videojs/ui/settings-menu';

export type VideoSettingsMenuProps = Omit<NonNullable<ComponentProps<typeof SettingsMenu>>, 'children'>;

export function VideoSettingsMenu(props: VideoSettingsMenuProps = {}) {
  return (
    <SettingsMenu {...props}>
      <QualityMenu />
      <AudioTrackMenu />
      <PlaybackRateSubmenu />
      <CaptionsSubmenu />
    </SettingsMenu>
  );
}
