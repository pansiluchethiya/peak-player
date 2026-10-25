import { Player } from '@/components/Player';
import { apiBase, embedConfig } from '@/lib/embedPage';

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
  return <Player apiBase={apiBase()} media={{ type: 'movie', id, poster }} embed={embed} />;
}
