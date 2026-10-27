'use client';

import dynamic from 'next/dynamic';

const muxEnvKey = process.env.NEXT_PUBLIC_MUX_DATA_ENV_KEY ?? '';

export const muxEnabled = muxEnvKey.length > 0;

/**
 * `next/dynamic` must be called at module scope, so the adapter only enters the
 * tree when a key is configured. Self-hosted installs render nothing, which keeps
 * the Mux SDK and its console output out of the build entirely.
 */
const MuxData = muxEnabled
  ? dynamic(() => import('@videojs/react/extensions/mux-data').then((module) => module.MuxData), {
      ssr: false,
    })
  : null;

export function MuxAnalytics() {
  if (!MuxData) return null;
  return <MuxData envKey={muxEnvKey} metadata={{ player_name: 'Peak' }} />;
}
