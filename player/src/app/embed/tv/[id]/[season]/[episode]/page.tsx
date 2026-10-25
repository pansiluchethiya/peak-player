import { Player } from '@/components/Player';
import { apiBase, embedConfig } from '@/lib/embedPage';

export const dynamic = 'force-dynamic';

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
  return (
    <Player
      apiBase={apiBase()}
      media={{ type: 'tv', id, season: positive(season), episode: positive(episode), poster }}
      embed={embed}
    />
  );
}
