import { Player } from '@/components/Player';
import { use } from 'react';

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
  return <Player apiBase={apiBase()} media={{ type: 'movie', id, poster }} />;
}
