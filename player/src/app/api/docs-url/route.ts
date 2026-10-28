import { NextResponse } from 'next/server';

/**
 * Runtime docs URL endpoint.
 *
 * The player can be built with NEXT_PUBLIC_DOCS_URL (compiled into the client
 * bundle at build time). When that is not set, the client falls back to
 * fetching /api/docs-url at runtime, which reads PEAK_DOCS_URL from the server
 * environment.
 *
 * @see docs/superpowers/specs/2026-10-28-docs-overhaul-spec.md §4
 */
export async function GET() {
  const url = process.env.PEAK_DOCS_URL || process.env.NEXT_PUBLIC_DOCS_URL || 'https://docs.peak-player.com';
  return NextResponse.json({ docsUrl: url }, { headers: { 'Cache-Control': 'public, max-age=600' } });
}
