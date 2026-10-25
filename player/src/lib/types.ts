export type MediaType = 'movie' | 'tv' | 'live_tv';

export interface Media {
  type: MediaType;
  id: string;
  season?: number;
  episode?: number;
  group?: string;
  logo?: string;
  poster?: string;
}

export interface Source {
  url: string;
  quality: string;
  codec: string;
  provider: string;
  adaptive?: boolean;
  expiresIn: number;
}

export interface Subtitle {
  url: string;
  lang: string;
  label: string;
  provider: string;
}

export interface Diagnostic {
  provider: string;
  ok: boolean;
  latencyMs: number;
  error?: string;
}

export interface StreamResponse {
  id: string;
  type: MediaType;
  title: string;
  year?: string | number;
  sources: Source[];
  subtitles: Subtitle[];
  meta?: Record<string, unknown>;
  diagnostics: Diagnostic[];
  group?: string;
  logo?: string;
}

export interface Branding {
  name: string;
  logoUrl: string;
  accentColor: string;
  tagline: string;
}

export const DEFAULT_BRANDING: Branding = {
  name: 'Peak',
  logoUrl: '/logo.svg',
  accentColor: '#2f6b4f',
  tagline: 'Cinema, elevated.',
};

export interface Fingerprint {
  hash: string;
  userAgent: string;
  screen: string;
  timezone: string;
  language: string;
}
