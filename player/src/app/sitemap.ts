import type { MetadataRoute } from 'next';

/**
 * Sitemap for the Peak player app.
 * Includes the landing page, embed pages, and media pages.
 *
 * @see docs/superpowers/specs/2026-10-28-docs-overhaul-spec.md §6.1
 */
const baseUrl = process.env.NEXT_PUBLIC_PLAYER_URL || 'https://app.peak-player.com';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/embed/demo`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/movie/550`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/tv/1399/1/1`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
  ];
}
