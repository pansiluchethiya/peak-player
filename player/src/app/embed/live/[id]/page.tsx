import { PlayerRoot } from '@/components/player';
import { apiBase, embedConfig } from '@/lib/embedPage';
import type { Media } from '@/lib/types';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Peak Embed',
  description: 'Embeddable player with signed sessions and validated sources.',
  robots: { index: false, follow: false },
};

export default async function EmbedLivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const embed = await embedConfig();
  const media: Media = { type: 'live_tv', id };
  return (
    <PlayerRoot
      apiBase={apiBase()}
      media={media}
      embed={embed}
      preset={media.type === 'live_tv' ? 'live-video' : 'video'}
    />
  );
}
