'use client';
import { useEffect, useState } from 'react';
import { fetchEpg, type LiveEpg } from '../../../lib/live';
import { usePlayerContext } from '../PlayerProvider';
import { t } from '../i18n';

interface SchedulePanelProps {
  apiBase: string;
  channelId: string;
}

/**
 * EPG schedule panel. Fetches now/next + a scrollable schedule when opened; on
 * any failure it renders `Guide unavailable` without disturbing playback.
 */
export function SchedulePanel({ apiBase, channelId }: SchedulePanelProps) {
  const { media } = usePlayerContext();
  const [open, setOpen] = useState(false);
  const [epg, setEpg] = useState<LiveEpg | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      try {
        const data = await fetchEpg(apiBase, channelId, controller.signal);
        if (!cancelled) setEpg(data);
      } catch {
        if (!cancelled) setEpg(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [open, apiBase, channelId]);

  const id = channelId || media.id;

  if (!open) {
    return (
      <button
        type="button"
        className="peak-schedule-toggle"
        aria-label={t('guide')}
        onClick={() => setOpen(true)}
      >
        {t('guide')}
      </button>
    );
  }

  return (
    <div className="peak-schedule-panel">
      <div className="peak-schedule-head">
        <strong>{t('guide')}</strong>
        <button type="button" className="peak-schedule-close" onClick={() => setOpen(false)}>
          ×
        </button>
      </div>
      {loading ? (
        <p className="peak-schedule-loading">{t('loading-guide')}</p>
      ) : epg ? (
        <div className="peak-schedule-list">
          {epg.now ? <div className="peak-schedule-now"><strong>{epg.now.title}</strong> {t('now')}</div> : null}
          {epg.next ? <div className="peak-schedule-next"><strong>{epg.next.title}</strong> {t('up-next')}</div> : null}
          {epg.schedule.length === 0 ? <p className="peak-schedule-empty">{t('no-guide')}</p> : null}
          {epg.schedule.map((p: { start: string; title: string }) => (
            <div key={`${p.start}-${p.title}`} className="peak-schedule-item">
              <span className="peak-schedule-time">{p.start}</span>
              <span className="peak-schedule-title">{p.title}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="peak-schedule-unavailable">{t('guide-unavailable')}</p>
      )}
    </div>
  );
}
