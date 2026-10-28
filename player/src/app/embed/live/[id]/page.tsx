import { PlayerRoot } from '@/components/player';
import { apiBase, embedConfig } from '@/lib/embedPage';
import type { Media } from '@/lib/types';

export const dynamic = 'force-dynamic';

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
