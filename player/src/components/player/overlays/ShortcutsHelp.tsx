'use client';
import { useEffect, useState } from 'react';
import { usePlayerContext } from '../PlayerProvider';
import { t } from '../i18n';

interface Props { onClose: () => void }

/** Keyboard shortcuts help overlay (spec §6.2). */
export function ShortcutsHelp({ onClose }: Props) {
  const { api } = usePlayerContext();
  void api;
  return (
    <div className="peak-shortcuts-help" role="dialog" aria-modal="true">
      <div className="peak-shortcuts-content">
        <h3>{t('shortcuts')}</h3>
        <ul>
          <li>Space / K — {t('play')}</li>
          <li>J / ← — {t('seek-back')}</li>
          <li>L / → — {t('seek-forward')}</li>
          <li>M — {t('mute')}</li>
          <li>F — {t('fullscreen')}</li>
          <li>P — {t('picture-in-picture')}</li>
          <li>C — {t('captions')}</li>
          <li>S — {t('speed')}</li>
          <li>? — {t('shortcuts')}</li>
          <li>N / B — next/previous episode</li>
        </ul>
        <button type="button" onClick={onClose}>{t('close')}</button>
      </div>
    </div>
  );
}
