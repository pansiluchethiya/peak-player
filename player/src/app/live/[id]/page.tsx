import { Player } from '@/components/Player';

export const dynamic = 'force-dynamic';

function apiBase(): string {
  return process.env.PUBLIC_API_URL ?? '';
}

export default async function LivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Player apiBase={apiBase()} media={{ type: 'live_tv', id }} />;
}
