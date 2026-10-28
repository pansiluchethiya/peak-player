'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Activity, Check, Clock3, CodeXml, Link2, Repeat } from 'lucide-react';
import { usePlayerContext } from '../PlayerProvider';
import { t } from '../i18n';
import { formatTimecode } from '../controls/TimeDisplay';

export interface ContextMenuPoint {
  x: number;
  y: number;
}

interface ContextMenuProps extends ContextMenuPoint {
  loop: boolean;
  onToggleLoop: () => void;
  onClose: () => void;
}

type CopyKey = 'url' | 'time' | 'embed';

async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy path below.
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/** Adds (or replaces) the `t` parameter that the player seeks to on load. */
export function timestampedUrl(href: string, seconds: number): string {
  const url = new URL(href);
  url.searchParams.set('t', String(Math.max(0, Math.floor(seconds))));
  return url.toString();
}

/**
 * Peak's own right-click surface. The browser menu is suppressed on the whole
 * player so this is the only context menu a viewer ever sees.
 */
export function ContextMenu({ x, y, loop, onToggleLoop, onClose }: ContextMenuProps) {
  const { api, media } = usePlayerContext();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [feedback, setFeedback] = useState<{ key: CopyKey; ok: boolean } | null>(null);
  const feedbackTimer = useRef(0);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const margin = 8;
    const left = Math.min(Math.max(x, margin), Math.max(window.innerWidth - rect.width - margin, margin));
    const top = Math.min(Math.max(y, margin), Math.max(window.innerHeight - rect.height - margin, margin));
    setPos({ left, top });
  }, [x, y]);

  useEffect(() => {
    const element = ref.current;
    element?.querySelector<HTMLButtonElement>('.peak-context-item')?.focus();
    const onPointer = (event: PointerEvent) => {
      if (element && !element.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      const items = Array.from(element?.querySelectorAll<HTMLButtonElement>('.peak-context-item') ?? []);
      if (items.length === 0) return;
      event.preventDefault();
      const current = items.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === 'ArrowDown' ? (current + 1) % items.length : (current - 1 + items.length) % items.length;
      items[next].focus();
    };
    document.addEventListener('pointerdown', onPointer, true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('blur', onClose);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('pointerdown', onPointer, true);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', onClose);
      window.removeEventListener('resize', onClose);
      window.clearTimeout(feedbackTimer.current);
    };
  }, [onClose]);

  const copy = useCallback(
    async (key: CopyKey, text: string) => {
      const ok = await writeClipboard(text);
      setFeedback({ key, ok });
      window.clearTimeout(feedbackTimer.current);
      feedbackTimer.current = window.setTimeout(onClose, ok ? 900 : 1500);
    },
    [onClose],
  );

  const copyUrl = () => copy('url', api.getShareLink());

  const copyUrlAtTime = () => {
    const seconds = api.getState().currentTime;
    copy('time', timestampedUrl(api.getShareLink(), seconds));
  };

  const copyEmbed = () => {
    const origin = window.location.origin;
    const id = encodeURIComponent(media.id);
    const path =
      media.type === 'tv'
        ? `/embed/tv/${id}/${media.season ?? 1}/${media.episode ?? 1}`
        : media.type === 'live_tv'
          ? `/embed/live/${id}`
          : `/embed/movie/${id}`;
    const src = (() => {
      const token = new URL(api.getShareLink()).searchParams.get('token');
      return token ? `${origin}${path}?token=${encodeURIComponent(token)}` : `${origin}${path}`;
    })();
    const code = `<iframe src="${src}" width="960" height="540" frameborder="0" allow="autoplay; fullscreen; picture-in-picture; clipboard-write" allowfullscreen></iframe>`;
    copy('embed', code);
  };

  const labelFor = (key: CopyKey, fallback: string) => {
    if (feedback?.key !== key) return fallback;
    return feedback.ok ? t('copied') : t('copy-failed');
  };

  const iconFor = (key: CopyKey, icon: React.ReactNode) => {
    if (feedback?.key === key) return feedback.ok ? <Check size={15} /> : icon;
    return icon;
  };

  const currentTime = api.getState().currentTime;

  return (
    <div
      ref={ref}
      className="peak-context-menu"
      role="menu"
      aria-label={t('player-menu')}
      style={{ left: pos?.left ?? x, top: pos?.top ?? y, visibility: pos ? 'visible' : 'hidden' }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <button
        type="button"
        className="peak-context-item"
        role="menuitemcheckbox"
        aria-checked={loop}
        onClick={() => {
          onToggleLoop();
          onClose();
        }}
      >
        <Repeat size={15} />
        <span>{t('loop')}</span>
        {loop ? <Check className="peak-context-check" size={14} /> : null}
      </button>
      <div className="peak-context-sep" role="separator" />
      <button type="button" className="peak-context-item" role="menuitem" onClick={copyUrl}>
        {iconFor('url', <Link2 size={15} />)}
        <span>{labelFor('url', t('copy-video-url'))}</span>
      </button>
      <button type="button" className="peak-context-item" role="menuitem" onClick={copyUrlAtTime}>
        {iconFor('time', <Clock3 size={15} />)}
        <span>{labelFor('time', t('copy-video-url-at-time'))}</span>
        <em className="peak-context-hint">{formatTimecode(currentTime)}</em>
      </button>
      <button type="button" className="peak-context-item" role="menuitem" onClick={copyEmbed}>
        {iconFor('embed', <CodeXml size={15} />)}
        <span>{labelFor('embed', t('copy-embed-code'))}</span>
      </button>
      <div className="peak-context-sep" role="separator" />
      <button
        type="button"
        className="peak-context-item"
        role="menuitem"
        onClick={() => {
          window.dispatchEvent(new Event('peak-toggle-stats'));
          onClose();
        }}
      >
        <Activity size={15} />
        <span>{t('stats')}</span>
      </button>
    </div>
  );
}
