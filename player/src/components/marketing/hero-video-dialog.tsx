'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Play, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HeroVideoDialogProps {
  className?: string;
  label?: string;
  title?: string;
}

const SOURCES = [
  { name: 'Vixsrc', detail: 'HLS · 1080p', state: 'ready' },
  { name: 'Videasy', detail: 'HLS · 1080p', state: 'ready' },
  { name: 'Netmirror', detail: 'HLS · 720p', state: 'ready' },
  { name: 'Vaplayer', detail: 'MP4 · 720p', state: 'ready' },
];

export function HeroVideoDialog({
  className,
  label = 'Open the player',
  title = 'Peak player preview',
}: HeroVideoDialogProps) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const dialog = dialogRef.current;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previous;
      trigger?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={cn('peak-hero-dialog', className)}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        <span className="peak-hero-play" aria-hidden="true">
          <span className="peak-hero-play-icon">
            <Play size={17} fill="currentColor" />
          </span>
        </span>
        {label}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="peak-dialog-backdrop"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              ref={dialogRef}
              className="peak-dialog"
              role="dialog"
              aria-modal="true"
              aria-label={title}
              initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: 12, scale: 0.99 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="peak-dialog-head">
                <div>
                  <p className="peak-eyebrow">Live preview</p>
                  <h2>{title}</h2>
                </div>
                <button
                  ref={closeRef}
                  type="button"
                  className="peak-dialog-close"
                  onClick={() => setOpen(false)}
                  aria-label="Close player preview"
                >
                  <X size={19} />
                </button>
              </div>

              <div className="peak-dialog-screen">
                <div className="peak-dialog-frame">
                  <div className="peak-preview-topline">
                    <span className="peak-preview-dot" />
                    <span>Peak / movie / 550</span>
                    <span className="peak-preview-badge">Signed session</span>
                  </div>
                  <div className="peak-preview-center">
                    <span className="peak-preview-play" aria-hidden="true">
                      <Play size={30} fill="currentColor" />
                    </span>
                    <p className="peak-preview-title">Fight Club</p>
                    <p className="peak-preview-sub">1999 · 2h 19m · 1080p</p>
                  </div>
                  <div className="peak-preview-timeline">
                    <span style={{ width: '36%' }} />
                  </div>
                  <div className="peak-preview-controls">
                    <span>03:48</span>
                    <span className="peak-preview-controls-right">
                      <span>CC</span>
                      <span>1080p</span>
                      <span>Auto</span>
                    </span>
                  </div>
                </div>
                <aside className="peak-dialog-rail" aria-label="Source health preview">
                  <p className="peak-dialog-rail-title">Source health</p>
                  {SOURCES.map((source) => (
                    <div className="peak-dialog-source" key={source.name}>
                      <span className="peak-dialog-source-dot" aria-hidden="true" />
                      <div>
                        <strong>{source.name}</strong>
                        <span>{source.detail}</span>
                      </div>
                      <em>{source.state}</em>
                    </div>
                  ))}
                  <p className="peak-dialog-note">
                    Sources are validated before they reach the player. Failover stays inside the
                    signed session.
                  </p>
                </aside>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
