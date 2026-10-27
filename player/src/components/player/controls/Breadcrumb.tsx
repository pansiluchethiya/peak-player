'use client';

import Link from 'next/link';
import type { MediaType } from '../../../lib/types';
import { t } from '../i18n';

export interface BreadcrumbProps {
  type: MediaType;
  title?: string;
  /** Inside an embed every step is plain text: the frame must not navigate away. */
  embed?: boolean;
}

const SECTION_KEY = {
  movie: 'movies',
  tv: 'tv',
  live_tv: 'live',
} as const;

const SECTION_HREF = {
  movie: '/?type=movie',
  tv: '/?type=tv',
  live_tv: '/?type=live',
} as const;

export function Breadcrumb({ type, title, embed = false }: BreadcrumbProps) {
  const section = t(SECTION_KEY[type]);
  const href = SECTION_HREF[type];

  return (
    <nav
      className={embed ? 'peak-breadcrumb is-embed' : 'peak-breadcrumb'}
      aria-label={t('breadcrumb')}
    >
      {embed ? <span>{t('home')}</span> : <Link href="/">{t('home')}</Link>}
      <span className="peak-breadcrumb-sep" aria-hidden="true">
        ›
      </span>
      {embed ? <span>{section}</span> : <Link href={href}>{section}</Link>}
      {title ? (
        <>
          <span className="peak-breadcrumb-sep" aria-hidden="true">
            ›
          </span>
          <span aria-current="page">{title}</span>
        </>
      ) : null}
    </nav>
  );
}
