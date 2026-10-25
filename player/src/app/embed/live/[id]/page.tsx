import { VideoJsEmbedPlayer } from '@/components/VideoJsPlayer';
import { apiBase, embedConfig } from '@/lib/embedPage';

export const dynamic = 'force-dynamic';

export default async function EmbedLivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const embed = await embedConfig();
  return <VideoJsEmbedPlayer apiBase={apiBase()} media={{ type: 'live_tv', id }} embed={embed} />;
}
