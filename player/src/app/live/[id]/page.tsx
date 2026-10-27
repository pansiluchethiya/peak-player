import { PlayerRoot } from '@/components/player';
import type { Media } from '@/lib/types';

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
