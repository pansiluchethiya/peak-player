import type { MetadataRoute } from 'next';

/**
 * robots.txt — docs site.
 * Index documentation and guides; allow all.
 *
 * @see docs/superpowers/specs/2026-10-28-docs-overhaul-spec.md §6.2
 */
const baseUrl = 'https://docs.peak-player.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
