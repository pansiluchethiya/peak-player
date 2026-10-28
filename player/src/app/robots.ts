import type { MetadataRoute } from 'next';

/**
 * robots.txt — player app.
 * Index everything except embed frames (which are noindex).
 *
 * @see docs/superpowers/specs/2026-10-28-docs-overhaul-spec.md §6.1
 */
const baseUrl = process.env.NEXT_PUBLIC_PLAYER_URL || 'https://app.peak-player.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/embed/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
