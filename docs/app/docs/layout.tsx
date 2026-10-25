import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import type { ReactNode } from 'react';
import { source } from '@/lib/source';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.pageTree}
      nav={{
        title: (
          <span className="flex items-center gap-2.5 font-semibold tracking-tight">
            <img src="/logo.svg" alt="" width={26} height={26} className="rounded-md" />
            Peak Docs
          </span>
        ),
        url: '/',
      }}
      links={[
        { text: 'Overview', url: '/' },
        { text: 'Quickstart', url: '/docs/quickstart' },
        { text: 'API reference', url: '/docs/api-reference' },
      ]}
      sidebar={{ defaultOpenLevel: 1 }}
    >
      {children}
    </DocsLayout>
  );
}
