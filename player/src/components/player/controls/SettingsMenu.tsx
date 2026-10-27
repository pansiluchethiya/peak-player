'use client';
import { usePlayerContext } from '../PlayerProvider';
import { t } from '../i18n';
import { ControlButton } from './ControlButton';
import { CaptionsMenu } from '../menus/CaptionsMenu';
import { ColourMenu } from '../menus/ColourMenu';
import { AspectMenu } from '../menus/AspectMenu';
import { SpeedMenu } from '../menus/SpeedMenu';

/** Settings cog: nests the presentation menus (captions, speed, colour, aspect). */
export function SettingsMenu() {
  return (
    <nav className="peak-settings-menu" aria-label={t('settings')}>
      <CaptionsMenu />
      <SpeedMenu />
      <ColourMenu />
      <AspectMenu />
    </nav>
  );
}
