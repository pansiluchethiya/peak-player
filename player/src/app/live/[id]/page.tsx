import { PlayerRoot } from '@/components/player';
import type { Media } from '@/lib/types';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

function apiBase(): string {
  return process.env.PUBLIC_API_URL ?? '';
}

export default async function LivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const media: Media = { type: 'live_tv', id };
  return (
    <PlayerRoot
      apiBase={apiBase()}
      media={media}
      preset={media.type === 'live_tv' ? 'live-video' : 'video'}
    />
  );
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Live ${id} · Peak`,
    openGraph: {
      title: `Live TV ${id} · Peak Player`,
      description: 'Watch live TV using the Peak embeddable player.',
      type: 'video.other',
      url: `https://app.peak-player.com/live/${id}`,
    },
    robots: { index: true, follow: true },
  };
}
