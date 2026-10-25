import { Player } from '@/components/Player';

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
  return (
    <Player
      apiBase={apiBase()}
      media={{ type: 'tv', id, season: positive(season), episode: positive(episode), poster }}
    />
  );
}
