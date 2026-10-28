'use client';
import { CaptionsOff, Minus, Plus, Subtitles } from 'lucide-react';
import { MenuRoot, type MenuOption } from './MenuRoot';
import { usePlayerContext } from '../PlayerProvider';
import { flagForLanguage } from './languageFlags';
import { t } from '../i18n';
import type { CaptionEdge, CaptionSize } from '../prefs/schema';

const SIZES: Array<{ value: CaptionSize; label: string }> = [
  { value: 'sm', label: t('caption-small') },
  { value: 'md', label: t('caption-medium') },
  { value: 'lg', label: t('caption-large') },
  { value: 'xl', label: t('caption-extra-large') },
];

const EDGES: Array<{ value: CaptionEdge; label: string }> = [
  { value: 'none', label: t('caption-edge-none') },
  { value: 'shadow', label: t('caption-edge-shadow') },
  { value: 'outline', label: t('caption-edge-outline') },
  { value: 'background', label: t('caption-edge-background') },
];

function offsetLabel(offset: number): string {
  if (offset === 0) return '0s';
  return `${offset > 0 ? '+' : ''}${offset.toFixed(1)}s`;
}

export function CaptionsMenu() {
  const { api, preferences, subtitles } = usePlayerContext();
  const settings = preferences.captions;
  const uniqueTracks = subtitles.filter(
    (sub, index, all) => all.findIndex((item) => item.label === sub.label) === index,
  );
  const trackOptions: MenuOption[] = uniqueTracks.map((sub) => ({
    value: sub.label,
    label: sub.label,
    icon: <span className="peak-flag">{flagForLanguage(sub.lang, sub.label)}</span>,
  }));
  if (!uniqueTracks.find((s) => s.label === settings.language)) {
    trackOptions.unshift({ value: 'off', label: t('captions-off'), icon: <CaptionsOff size={14} /> });
  }
  const selected = trackOptions.find((option) => option.value === settings.language);
  const selectedLabel = selected?.label ?? t('captions-off');

  const patch = (value: Parameters<typeof api.setCaptions>[0]) =>
    api.setCaptions(value).catch(() => undefined);
  const setOffset = (next: number) => patch({ offset: Math.min(10, Math.max(-10, next)) });

  return (
    <MenuRoot
      width={252}
      trigger={
        <>
          <span className="peak-menu-label"><Subtitles size={14} /><span>{t('captions')}</span></span>
          <span className="peak-menu-value">{selectedLabel}</span>
        </>
      }
      options={trackOptions}
      selected={settings.language ?? 'off'}
      label={t('captions')}
      onSelect={(value) => {
        const track = uniqueTracks.find((s) => s.label === value);
        if (value === 'off' || !track) {
          patch({ enabled: false });
        } else {
          patch({ enabled: true, language: track.label ?? track.lang });
        }
      }}
      footer={
        <div className="peak-caption-settings">
          <div className="peak-caption-row">
            <span>{t('caption-offset')}</span>
            <div className="peak-caption-stepper">
              <button type="button" aria-label="Earlier" onClick={() => setOffset(settings.offset - 0.5)}>
                <Minus size={13} />
              </button>
              <span>{offsetLabel(settings.offset)}</span>
              <button type="button" aria-label="Later" onClick={() => setOffset(settings.offset + 0.5)}>
                <Plus size={13} />
              </button>
            </div>
          </div>
          <div className="peak-caption-row">
            <span>{t('caption-size')}</span>
            <div className="peak-caption-chips">
              {SIZES.map((size) => (
                <button
                  key={size.value}
                  type="button"
                  aria-pressed={settings.size === size.value}
                  onClick={() => patch({ size: size.value })}
                >
                  {size.label}
                </button>
              ))}
            </div>
          </div>
          <div className="peak-caption-row">
            <span>{t('caption-background')}</span>
            <div className="peak-caption-chips">
              <button type="button" aria-pressed={settings.mica} onClick={() => patch({ mica: true })}>
                {t('caption-background-on')}
              </button>
              <button type="button" aria-pressed={!settings.mica} onClick={() => patch({ mica: false })}>
                {t('caption-background-off')}
              </button>
            </div>
          </div>
          <div className="peak-caption-row">
            <span>{t('caption-edge')}</span>
            <div className="peak-caption-chips">
              {EDGES.map((edge) => (
                <button
                  key={edge.value}
                  type="button"
                  aria-pressed={settings.edge === edge.value}
                  onClick={() => patch({ edge: edge.value })}
                >
                  {edge.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      }
    />
  );
}
