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

export interface MediaMetadata {
  id: string;
  type: MediaType;
  title: string;
  year: number | null;
  overview: string | null;
  tagline: string | null;
  runtime: number | null;
  genres: string[];
  rating: number | null;
  poster: { candidates: string[] };
  backdrop: string | null;
  stills: string[];
  seriesPoster: string | null;
  source: 'tmdb' | 'wikidata' | 'wikipedia' | 'tvmaze' | 'generated';
}

export interface EmbedConfig {
  partnerId?: string;
  origins: string[];
  preferenceMode?: string;
  preferences?: Record<string, unknown>;
  prefsLocked?: string[];
}

export interface Source {
  url: string;
  quality: string;
  codec: string;
  provider: string;
  adaptive?: boolean;
  expiresIn: number;
  container?: string;
  videoCodec?: string;
  audioCodec?: string;
  hdr?: boolean;
  browserPlayable?: boolean;
  /** Remote WebVTT sprite sheet for scrubber previews. */
  thumbnailVtt?: string | null;
  /** Dub language label when the source is a language-specific rendition. */
  dub?: string | null;
  /** ISO language code for the dub, when known. */
  audioLang?: string | null;
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
  media?: MediaMetadata;
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
  /** Provider autoplay defaults surfaced to the player. */
  preferences?: { autoplay: boolean; autoplayMuted: boolean };
  /** Storage mode the provider wants the player to use. */
  preferenceMode?: string;
}

export const DEFAULT_BRANDING: Branding = {
  name: 'Peak',
  logoUrl: '/logo.svg',
  accentColor: 'var(--color-accent)',
  tagline: 'Cinema, elevated.',
};

export interface EpgProgramme {
  channelId: string;
  start: string;
  stop: string;
  title: string;
  description: string | null;
  category: string | null;
}

export interface Fingerprint {
  hash: string;
  userAgent: string;
  screen: string;
  timezone: string;
  language: string;
}
