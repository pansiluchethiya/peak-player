'use client';
import { useState } from 'react';
import { Settings, SlidersHorizontal, X } from 'lucide-react';
import { t } from '../i18n';
import { ControlButton } from './ControlButton';
import { ServerMenu } from '../menus/ServerMenu';
import { QualityMenu } from '../menus/QualityMenu';
import { AudioMenu } from '../menus/AudioMenu';
import { CaptionsMenu } from '../menus/CaptionsMenu';
import { ColourMenu } from '../menus/ColourMenu';
import { AspectMenu } from '../menus/AspectMenu';
import { SpeedMenu } from '../menus/SpeedMenu';

/**
 * Settings cog. One popup owns every Peak control that is not transport:
 * server, quality, audio, captions, speed, colour, and aspect. The vendored
 * videojs chrome is intentionally not rendered, so this is the only settings
 * surface a viewer can reach.
 */
export function SettingsMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="peak-settings">
      <ControlButton
        aria-label={t('settings')}
        aria-haspopup="dialog"
        aria-expanded={open}
        icon={<Settings size={18} />}
        onClick={() => setOpen((value) => !value)}
      />
      {open ? (
        <div className="peak-settings-popup" role="dialog" aria-label={t('settings')}>
          <div className="peak-settings-head">
            <span className="peak-settings-title">
              <SlidersHorizontal size={14} />
              {t('settings')}
            </span>
            <button
              type="button"
              className="peak-settings-close"
              aria-label={t('close')}
              onClick={() => setOpen(false)}
            >
              <X size={15} />
            </button>
          </div>
          <div className="peak-settings-rows">
            <ServerMenu />
            <QualityMenu />
            <AudioMenu />
            <CaptionsMenu />
            <SpeedMenu />
            <ColourMenu />
            <AspectMenu />
          </div>
        </div>
      ) : null}
    </div>
  );
}
