import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/page';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getMDXComponents } from '@/mdx-components';
import { source } from '@/lib/source';

interface PageProps {
  params: Promise<{ slug?: string[] }>;
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();

  const MDX = page.data.body;
  return (
    <DocsPage
      toc={page.data.toc}
      full={page.data.full}
    >
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        {/* JSON-LD per-page Article structured data (spec §6.2) */}
        <JsonLdScript page={page} />
        <MDX components={getMDXComponents()} />
      </DocsBody>
    </DocsPage>
  );
}

/** Inline JSON-LD for the current page as an Article. */
function JsonLdScript({ page }: { page: { data: { title?: string; description?: string }; url: string } }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: page.data.title ?? page.url,
    description: page.data.description ?? '',
    url: `https://docs.peak-player.com${page.url}`,
    publisher: {
      '@type': 'Organization',
      name: 'Peak',
      logo: { '@type': 'ImageObject', url: 'https://peak-player.com/logo.svg' },
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();
  return {
    title: page.data.title,
    description: page.data.description,
  };
}
