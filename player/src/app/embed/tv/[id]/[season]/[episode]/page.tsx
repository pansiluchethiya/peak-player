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

function positive(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export default async function EmbedTvPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; season: string; episode: string }>;
  searchParams: Promise<{ poster?: string }>;
}) {
  const { id, season, episode } = await params;
  const { poster } = await searchParams;
  const embed = await embedConfig();
  const media: Media = {
    type: 'tv',
    id,
    season: positive(season),
    episode: positive(episode),
    poster,
  };
  return (
    <PlayerRoot
      apiBase={apiBase()}
      media={media}
      embed={embed}
      preset={media.type === 'live_tv' ? 'live-video' : 'video'}
    />
  );
}
