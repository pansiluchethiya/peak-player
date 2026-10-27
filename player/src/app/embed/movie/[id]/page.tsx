import { PlayerRoot } from '@/components/player';
import { apiBase, embedConfig } from '@/lib/embedPage';
import type { Media } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function EmbedMoviePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ poster?: string }>;
}) {
  const { id } = await params;
  const { poster } = await searchParams;
  const embed = await embedConfig();
  const media: Media = { type: 'movie', id, poster };
  return (
    <PlayerRoot
      apiBase={apiBase()}
      media={media}
      embed={embed}
      preset={media.type === 'live_tv' ? 'live-video' : 'video'}
    />
  );
}
