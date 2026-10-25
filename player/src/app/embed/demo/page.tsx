import type { Metadata } from 'next';
import { DemoClient } from './DemoClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Peak Embed demo',
  description: 'Try the signed Peak embed player and SDK.',
};

export default function EmbedDemoPage() {
  return (
    <main className="embed-demo">
      <DemoClient />
    </main>
  );
}
