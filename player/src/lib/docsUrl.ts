/**
 * Resolve the documentation URL for the player UI.
 *
 * Build-time: NEXT_PUBLIC_DOCS_URL is compiled into the client bundle.
 * Runtime fallback: fetch /api/docs-url which reads PEAK_DOCS_URL server-side.
 * Default: https://docs.peak-player.com
 *
 * @see docs/superpowers/specs/2026-10-28-docs-overhaul-spec.md §4
 */

const BUILT_IN = process.env.NEXT_PUBLIC_DOCS_URL || '';

export function getDocsUrl(): string {
  return BUILT_IN || 'https://docs.peak-player.com';
}

export async function fetchDocsUrl(): Promise<string> {
  if (BUILT_IN) return BUILT_IN;
  try {
    const res = await fetch('/api/docs-url', { next: { revalidate: 600 } });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json() as { docsUrl?: string };
    return data.docsUrl || 'https://docs.peak-player.com';
  } catch {
    return 'https://docs.peak-player.com';
  }
}
