'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchDocsUrl } from '@/lib/docsUrl';

/**
 * MiniPlayerDemo — an inline iframe pointing to the live `/embed/demo` player.
 * Shows the player in action without leaving the landing page.
 *
 * @see docs/superpowers/specs/2026-10-28-docs-overhaul-spec.md §9
 */
export function MiniPlayerDemo() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [docsUrl, setDocsUrl] = useState<string>('https://docs.peak-player.com');

  useEffect(() => {
    void fetchDocsUrl().then(setDocsUrl);
  }, []);

  const demoUrl = `${process.env.NEXT_PUBLIC_API_BASE || window.location.origin}/embed/demo`;

  return (
    <div className="mini-player-demo">
      <div className="mini-player-chrome">
        <span className="mini-player-url">{demoUrl.replace(window.location.origin, '')}</span>
      </div>
      <iframe
        ref={iframeRef}
        src={demoUrl}
        title="Peak player demo"
        allow="accelerometer; autoplay; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
      />
      <p className="mini-player-caption">
        Live demo — the same signed-session player you can embed. No upstream URLs exposed.
        <a href={docsUrl} target="_blank" rel="noopener noreferrer">
          Read the docs
        </a>
      </p>
    </div>
  );
}
