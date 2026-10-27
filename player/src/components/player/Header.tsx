'use client';

import { t } from './i18n';

export interface HeaderProps {
  title?: string;
  year?: string | number;
  /** Runtime in minutes. Task 8 adds it to the media metadata. */
  runtime?: number;
  quality?: string;
  locale?: string;
}

function formatYear(year: string | number | undefined, locale: string): string | null {
  if (year === undefined || year === null || year === '') return null;
  const value = typeof year === 'number' ? year : Number(year);
  if (!Number.isFinite(value)) return null;
  return new Intl.NumberFormat(locale, { useGrouping: false }).format(value);
}

function formatRuntime(runtime: number | undefined, locale: string): string | null {
  if (runtime === undefined || !Number.isFinite(runtime) || runtime <= 0) return null;
  const minutes = new Intl.NumberFormat(locale).format(Math.round(runtime));
  return t('minutes', { minutes });
}

/** Title, year, runtime, and quality chip. The vendored skin no longer owns a title. */
export function Header({ title, year, runtime, quality, locale = 'en' }: HeaderProps) {
  const yearLabel = formatYear(year, locale);
  const runtimeLabel = formatRuntime(runtime, locale);
  const hasMeta = Boolean(yearLabel || runtimeLabel || quality);

  if (!title && !hasMeta) return null;

  return (
    <header className="peak-player-header">
      {title ? <h1 className="peak-player-header-title">{title}</h1> : null}
      {hasMeta ? (
        <div className="peak-player-header-meta">
          {yearLabel ? <span>{yearLabel}</span> : null}
          {runtimeLabel ? <span>{runtimeLabel}</span> : null}
          {quality ? (
            <span className="peak-player-header-quality" aria-label={t('quality')}>
              {quality}
            </span>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
