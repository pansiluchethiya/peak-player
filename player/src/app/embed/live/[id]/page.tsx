import { Player } from '@/components/Player';
import { apiBase, embedConfig } from '@/lib/embedPage';

export const dynamic = 'force-dynamic';

export default async function EmbedLivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const embed = await embedConfig();
  return <Player apiBase={apiBase()} media={{ type: 'live_tv', id }} embed={embed} />;
}
