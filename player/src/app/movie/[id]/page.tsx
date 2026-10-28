import { PlayerRoot } from '@/components/player';
import type { Media } from '@/lib/types';

export const dynamic = 'force-dynamic';

function apiBase(): string {
  return process.env.PUBLIC_API_URL ?? '';
}

export default async function MoviePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ poster?: string }>;
}) {
  const { id } = await params;
  const { poster } = await searchParams;
  const media: Media = { type: 'movie', id, poster };
  return (
    <PlayerRoot
      apiBase={apiBase()}
      media={media}
      preset={media.type === 'live_tv' ? 'live-video' : 'video'}
    />
  );
}
