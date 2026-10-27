import { headers } from 'next/headers';
import type { EmbedConfig } from '@/lib/types';
import { isValidPreferenceMode, type PreferenceMode } from '@/components/player/prefs/modes';

export function apiBase(): string {
  return process.env.PUBLIC_API_URL ?? '';
}

interface PrefsHeader {
  mode?: PreferenceMode;
  preferences?: unknown;
  locked?: string[];
}

function parsePrefsHeader(value: string | null): PrefsHeader {
  if (!value) return {};
  try {
    const json = Buffer.from(value, 'base64').toString('utf8');
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === 'object') return parsed as PrefsHeader;
  } catch {
    // ignore malformed header
  }
  return {};
}

/**
 * Reads the embed token fields forwarded by `middleware.ts` into the Next
 * request headers and resolves the effective preference mode + seed preferences.
 */
export async function embedConfig(): Promise<EmbedConfig> {
  const values = await headers();
  const origins = (values.get('x-peak-embed-origins') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const prefsHeader = parsePrefsHeader(values.get('x-peak-embed-prefs'));
  const modeHeader = values.get('x-peak-embed-prefs-mode') ?? undefined;
  const config: EmbedConfig = {
    partnerId: values.get('x-peak-embed-partner') ?? undefined,
    origins,
  };
  if (modeHeader && isValidPreferenceMode(modeHeader)) {
    config.preferenceMode = modeHeader;
  }
  if (prefsHeader.preferences) {
    config.preferences = prefsHeader.preferences as Record<string, unknown>;
  }
  if (Array.isArray(prefsHeader.locked)) {
    config.prefsLocked = prefsHeader.locked as string[];
  }
  return config;
}
