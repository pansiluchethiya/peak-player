import { createFromSource, type AdvancedIndex } from 'fumadocs-core/search/server';
import { source } from '@/lib/source';

export const { GET } = createFromSource(source, (page) => {
  // `remarkStructure` adds `structuredData` at build time, but the generated
  // MDX types from fumadocs-mdx 11 do not include plugin-added exports.
  const { structuredData } = page.data as typeof page.data & {
    structuredData: AdvancedIndex['structuredData'];
  };

  return {
    title: page.data.title ?? page.url,
    description: page.data.description ?? '',
    url: page.url,
    id: page.url,
    breadcrumbs: [],
    structuredData,
  };
});
