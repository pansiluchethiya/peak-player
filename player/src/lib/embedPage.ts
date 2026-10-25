import { headers } from 'next/headers';
import type { EmbedConfig } from '@/lib/types';

export function apiBase(): string {
  return process.env.PUBLIC_API_URL ?? '';
}

export async function embedConfig(): Promise<EmbedConfig> {
  const values = await headers();
  const origins = (values.get('x-peak-embed-origins') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return {
    partnerId: values.get('x-peak-embed-partner') ?? undefined,
    origins,
  };
}
