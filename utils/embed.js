// Embed URL builder for Peak's custom player.
// The player UI is served separately and reads streams from Peak's /api/v1 API.
const { findPartnerByApiKey } = require('./embedPartners');
const {
  normalizeTtlSeconds,
  signEmbedToken,
  verifyEmbedToken,
} = require('./embedToken');

const DEFAULT_SOURCE = 'netmirror';
const DEFAULT_PLAYER_URL = 'http://localhost:3001';

function configError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizeBaseUrl(value, { required = false } = {}) {
  const raw = String(value || '').trim();
  if (!raw) {
    if (required) {
      throw configError(
        'PLAYER_PUBLIC_URL is required in production',
        'PLAYER_PUBLIC_URL_REQUIRED',
      );
    }
    return DEFAULT_PLAYER_URL;
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw configError('PLAYER_PUBLIC_URL must be a valid URL', 'INVALID_PLAYER_PUBLIC_URL');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw configError('PLAYER_PUBLIC_URL must use http or https', 'INVALID_PLAYER_PUBLIC_URL');
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw configError(
      'PLAYER_PUBLIC_URL must not contain credentials, a query, or a fragment',
      'INVALID_PLAYER_PUBLIC_URL',
    );
  }
  const pathname = parsed.pathname.replace(/\/+$/, '');
  return `${parsed.origin}${pathname}`;
}

function normalizeType(type) {
  const value = String(type || '').toLowerCase();
  if (value === 'movie') return 'movie';
  if (value === 'tv' || value === 'series') return 'tv';
  if (value === 'live_tv' || value === 'live') return 'live_tv';
  return null;
}

function normalizePositiveInt(value, fallback) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function playerBaseUrl() {
  const configured = String(process.env.PLAYER_PUBLIC_URL || '').trim();
  return normalizeBaseUrl(configured, {
    required: !configured && process.env.NODE_ENV === 'production',
  });
}

function mediaPath(media, prefix = '') {
  if (media.type === 'tv') {
    return `${prefix}/tv/${encodeURIComponent(media.id)}/${media.season}/${media.episode}`;
  }
  if (media.type === 'live_tv') {
    return `${prefix}/live/${encodeURIComponent(media.id)}`;
  }
  return `${prefix}/movie/${encodeURIComponent(media.id)}`;
}

function buildPlayerUrl(media) {
  const params = new URLSearchParams();
  if (media.poster) params.set('poster', media.poster);
  const qs = params.toString();
  const suffix = qs ? `?${qs}` : '';
  return `${playerBaseUrl()}${mediaPath(media)}${suffix}`;
}

function buildEmbedUrl(media, token, { baseUrl } = {}) {
  const base = baseUrl ? normalizeBaseUrl(baseUrl) : playerBaseUrl();
  const params = new URLSearchParams();
  if (token) params.set('token', token);
  if (media.poster) params.set('poster', media.poster);
  const qs = params.toString();
  const suffix = qs ? `?${qs}` : '';
  return `${base}${mediaPath(media, '/embed')}${suffix}`;
}

async function getEmbed({ type, id, season, episode, source, poster: posterOverride } = {}) {
  const mediaType = normalizeType(type);
  if (!mediaType) {
    return {
      status: 400,
      error: 'INVALID_TYPE',
      message: 'type must be movie, tv, series, or live_tv',
    };
  }

  const mediaId = String(id || '').trim();
  if (!mediaId) {
    return {
      status: 400,
      error: 'INVALID_ID',
      message: 'id is required',
    };
  }

  if (mediaType !== 'live_tv') {
    if (!/^\d+$/.test(mediaId)) {
      return {
        status: 400,
        error: 'INVALID_ID',
        message: 'id must be a numeric TMDB id',
      };
    }
  }

  if (mediaType !== 'live_tv') {
    const requestedSource = String(source || DEFAULT_SOURCE).toLowerCase();
    if (requestedSource !== DEFAULT_SOURCE) {
      return {
        status: 400,
        error: 'INVALID_SOURCE',
        message: `unsupported embed source: ${requestedSource}`,
      };
    }
  }

  const media = {
    type: mediaType,
    id: mediaId,
    season: mediaType === 'tv' ? normalizePositiveInt(season, 1) : null,
    episode: mediaType === 'tv' ? normalizePositiveInt(episode, 1) : null,
  };

  let poster = posterOverride;
  if (!poster && mediaType !== 'live_tv') {
    try {
      const { getDetails } = require('./tmdb');
      const details = await getDetails(mediaType, mediaId);
      poster = details?.poster_path;
    } catch { /* ignore */ }
  }
  if (poster) media.poster = poster;

  let url;
  try {
    url = buildPlayerUrl(media);
  } catch (error) {
    return {
      status: 500,
      error: error.code || 'INVALID_PLAYER_URL',
      message: error.message,
    };
  }

  return {
    status: 200,
    type: mediaType,
    id: mediaId,
    season: media.season,
    episode: media.episode,
    poster,
    source: mediaType === 'live_tv' ? null : DEFAULT_SOURCE,
    provider: 'Peak Player',
    url,
    playerUrl: url,
  };
}

async function createEmbedSession({
  apiKey,
  type,
  id,
  season,
  episode,
  source,
  poster,
  ttlSeconds,
  now,
  prefsMode,
  preferences,
  prefsLocked,
} = {}) {
  const partner = findPartnerByApiKey(apiKey);
  if (!partner) {
    return {
      status: 401,
      error: 'INVALID_API_KEY',
      message: 'a valid x-api-key header is required',
    };
  }

  const embed = await getEmbed({ type, id, season, episode, source, poster });
  if (embed.error) return embed;

  const tokenPayload = {
    v: 1,
    partnerId: partner.id,
    type: embed.type,
    id: embed.id,
    season: embed.season,
    episode: embed.episode,
    origins: partner.origins,
  };

  // Persist preference mode + seed preferences in the signed token so the
  // player can resolve them server-side without extra round-trips.
  const VALID_MODES = ['browser', 'server', 'user'];
  if (typeof prefsMode === 'string' && VALID_MODES.includes(prefsMode)) {
    tokenPayload.preferenceMode = prefsMode;
  }
  if (preferences && typeof preferences === 'object') {
    tokenPayload.preferences = preferences;
  }
  if (Array.isArray(prefsLocked)) {
    tokenPayload.prefsLocked = prefsLocked;
  }

  const issuedAt = Number.isFinite(now) ? now : Date.now();
  const token = signEmbedToken(tokenPayload, { ttlSeconds: normalizeTtlSeconds(ttlSeconds), now: issuedAt });

  const verified = verifyEmbedToken(token, { now: issuedAt });
  if (!verified.ok) {
    return {
      status: 500,
      error: 'TOKEN_SIGNING_FAILED',
      message: 'could not create a signed embed token',
    };
  }

  const url = buildEmbedUrl(embed, token);
  return {
    status: 200,
    token,
    expiresAt: new Date(verified.payload.exp * 1000).toISOString(),
    url,
    embedUrl: url,
    partner: { id: partner.id, name: partner.name },
    origins: partner.origins,
    type: embed.type,
    id: embed.id,
    season: embed.season,
    episode: embed.episode,
    poster: embed.poster,
     source: embed.source,
     preferenceMode: tokenPayload.preferenceMode,
  };
}

module.exports = {
  DEFAULT_SOURCE,
  DEFAULT_PLAYER_URL,
  buildEmbedUrl,
  buildPlayerUrl,
  createEmbedSession,
  getEmbed,
};
