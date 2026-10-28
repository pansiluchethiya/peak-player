import { PlayerRoot } from '@/components/player';
import type { Media } from '@/lib/types';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

function apiBase(): string {
  return process.env.PUBLIC_API_URL ?? '';
}

function positive(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export default async function TvPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; season: string; episode: string }>;
  searchParams: Promise<{ poster?: string }>;
}) {
  const { id, season, episode } = await params;
  const { poster } = await searchParams;
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
      preset={media.type === 'live_tv' ? 'live-video' : 'video'}
    />
  );
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; season: string; episode: string }>;
  searchParams: Promise<{ poster?: string }>;
}): Promise<Metadata> {
  const { id, season, episode } = await params;
  const { poster } = await searchParams;
  const posterUrl = poster || `https://image.tmdb.org/t/p/w500${id}.jpg`;
  return {
    title: `TV Show ${id} · Peak`,
    openGraph: {
      title: `TV Show ${id} · Peak Player`,
      description: 'Watch using the Peak embeddable player.',
      type: 'video.tv_show',
      url: `https://app.peak-player.com/tv/${id}/${season}/${episode}`,
      images: [{ url: posterUrl, width: 500, height: 750 }],
    },
    robots: { index: true, follow: true },
  };
}
