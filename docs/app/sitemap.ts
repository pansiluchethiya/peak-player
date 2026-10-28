import type { MetadataRoute } from 'next';
import { source } from '@/lib/source';

/**
 * Sitemap for the docs site.
 * Generates entries from the fumadocs content source plus static routes.
 *
 * @see docs/superpowers/specs/2026-10-28-docs-overhaul-spec.md §6.2
 */
const baseUrl = 'https://docs.peak-player.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = await source.getPages();

  const entries: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
  ];

  for (const page of pages) {
    entries.push({
      url: `${baseUrl}${page.url}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: page.url === '/docs' ? 0.9 : 0.8,
    });
  }

  return entries;
}
