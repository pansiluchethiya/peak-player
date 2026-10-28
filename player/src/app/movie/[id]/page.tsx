import { PlayerRoot } from '@/components/player';
import type { Media } from '@/lib/types';
import type { Metadata } from 'next';

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

export async function generateMetadata({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ poster?: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { poster } = await searchParams;
  const posterUrl = poster || `https://image.tmdb.org/t/p/w500${id}.jpg`;
  return {
    title: `Movie ${id} · Peak`,
    openGraph: {
      title: `Movie ${id} · Peak Player`,
      description: 'Watch using the Peak embeddable player.',
      type: 'video.movie',
      url: `https://app.peak-player.com/movie/${id}`,
      images: [{ url: posterUrl, width: 500, height: 750 }],
    },
    robots: { index: true, follow: true },
  };
}
