'use strict';

/**
 * Rive Stream provider.
 *
 * Rive exposes a public scrapper API that resolves a TMDB id to one or more
 * HLS sources. Apogee, Vanguard and Pulse carry the main English presentation;
 * Citadel is a per-language dub track (often Hindi) and is surfaced separately
 * in the player's Dubs menu.
 *
 * The scrapper is intentionally queried without credentials. Responses are
 * volatile and rate limited, so each provider is fetched independently and a
 * `data: null` reply is treated as "no source" rather than an error.
 */

const axios = require('axios');

const SCRAPPER_BASE = 'https://scrapper.rivestream.app';
const THUMBNAIL_META_URL = 'https://data.vidsrc.sh/api.php';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const REQUEST_HEADERS = {
  Accept: 'application/json',
  'User-Agent': USER_AGENT,
};

/**
 * Valhallastream only serves origins it recognises. The API process is the
 * client that fetches the wrapper and every segment, so it presents a local
 * origin; the wrapper's own `headers` query keeps the upstream CDN happy.
 */
const WRAPPER_HEADERS = {
  Origin: 'http://localhost:3011',
  Referer: 'http://localhost:3011/',
  'User-Agent': USER_AGENT,
};

const PROVIDERS = [
  { id: 'apogee', label: 'Apogee', provider: 'Peak Prime' },
  { id: 'vanguard', label: 'Vanguard', provider: 'Peak Stellar' },
  { id: 'pulse', label: 'Pulse', provider: 'Peak Nexus' },
  { id: 'citadel', label: 'Citadel', provider: 'Peak Orbit' },
];

const LANGUAGE_CODES = {
  english: 'en',
  hindi: 'hi',
  tamil: 'ta',
  telugu: 'te',
  kannada: 'kn',
  malayalam: 'ml',
  bengali: 'bn',
  marathi: 'mr',
  punjabi: 'pa',
  gujarati: 'gu',
  urdu: 'ur',
  arabic: 'ar',
  french: 'fr',
  spanish: 'es',
  german: 'de',
  italian: 'it',
  portuguese: 'pt',
  japanese: 'ja',
  korean: 'ko',
  chinese: 'zh',
  russian: 'ru',
};

function languageCode(value) {
  const key = String(value || '').trim().toLowerCase();
  return LANGUAGE_CODES[key] || key.slice(0, 2) || 'und';
}

/** Parse `720p | Hindi` into the dub language, or `null` for a plain quality. */
function parseDubLanguage(quality) {
  const match = String(quality || '').match(/\|\s*([A-Za-z][A-Za-z .'-]*)\s*$/);
  if (!match) return null;
  const language = match[1].trim();
  return language && language.toLowerCase() !== 'hls' ? language : null;
}

function isValhallastream(url) {
  try {
    return new URL(url).hostname.toLowerCase().endsWith('valhallastream.com');
  } catch {
    return false;
  }
}

function mapCaption(caption, provider) {
  const url = String(caption?.file || caption?.url || '');
  if (!url) return null;
  const label = String(caption?.label || caption?.language || 'Subtitles');
  return {
    url,
    lang: languageCode(caption?.language || label),
    label,
    provider,
  };
}

/**
 * Pure mapper, exported for tests. `thumbnailVtt` is shared by every source in
 * a title because the preview sprite is a property of the movie, not the CDN.
 */
function mapRiveSource(entry, providerInfo, captions = [], thumbnailVtt = null) {
  if (!entry || !entry.url) return null;
  const format = String(entry.format || 'hls').toLowerCase();
  if (format !== 'hls') return null;

  const url = String(entry.url);
  const dub = parseDubLanguage(entry.quality);
  const provider = providerInfo.provider;
  const subtitles = captions.map((caption) => mapCaption(caption, provider)).filter(Boolean);
  const stream = {
    name: `${providerInfo.label}${dub ? ` - ${dub}` : ''}`,
    title: `${providerInfo.label}${dub ? ` - ${dub}` : ''}`,
    url,
    quality: entry.quality || 'HLS',
    provider,
    codec: 'hls',
    adaptive: true,
    // Valhallastream wrappers are short lived; Citadel's signed URLs last hours.
    expiresIn: isValhallastream(url) ? 900 : 14_400,
    headers: isValhallastream(url) ? WRAPPER_HEADERS : { 'User-Agent': USER_AGENT },
  };

  // The wrapper URL embeds the upstream CDN in `?url=`. Validation and the
  // proxy must fetch the wrapper, not the upstream with the wrapper's headers.
  if (isValhallastream(url)) stream.unwrap = false;
  if (dub) {
    stream.dub = dub;
    stream.audioLang = languageCode(dub);
  }
  if (thumbnailVtt) stream.thumbnailVtt = thumbnailVtt;
  if (subtitles.length > 0) stream.subtitles = subtitles;
  return stream;
}

async function fetchProvider(providerInfo, tmdbId, type, season, episode) {
  try {
    const params = {
      provider: providerInfo.id,
      id: tmdbId,
      cb: Math.floor(Date.now() / 300_000),
    };
    if (type === 'tv') {
      params.season = season || 1;
      params.episode = episode || 1;
    }
    const response = await axios.get(`${SCRAPPER_BASE}/api/provider`, {
      params,
      headers: REQUEST_HEADERS,
      timeout: 6_000,
      validateStatus: (status) => status >= 200 && status < 300,
    });
    return response.data?.data || null;
  } catch {
    return null;
  }
}

async function fetchThumbnailVtt(tmdbId, type) {
  if (type !== 'movie') return null;
  try {
    const response = await axios.get(THUMBNAIL_META_URL, {
      params: { type: 'movie', tmdb: tmdbId },
      headers: REQUEST_HEADERS,
      timeout: 3_000,
      validateStatus: (status) => status >= 200 && status < 300,
    });
    const url = response.data?.thumbnails_url;
    return typeof url === 'string' && url.startsWith('http') ? url : null;
  } catch {
    return null;
  }
}

async function getRiveStreams(tmdbId, mediaType = 'movie', seasonNum = null, episodeNum = null) {
  const type = mediaType === 'movie' ? 'movie' : 'tv';
  const thumbnailVtt = await fetchThumbnailVtt(tmdbId, type);
  const results = await Promise.all(
    PROVIDERS.map(async (providerInfo) => {
      const data = await fetchProvider(providerInfo, tmdbId, type, seasonNum, episodeNum);
      if (!data || !Array.isArray(data.sources)) return [];
      const captions = Array.isArray(data.captions) ? data.captions : [];
      return data.sources
        .map((entry) => mapRiveSource(entry, providerInfo, captions, thumbnailVtt))
        .filter(Boolean);
    }),
  );
  return results.flat();
}

module.exports = {
  getRiveStreams,
  mapRiveSource,
  parseDubLanguage,
  PROVIDERS,
};
