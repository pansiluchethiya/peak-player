// Embed URL builder for Peak's custom player.
// The player UI is served separately and reads streams from Peak's /api/v1 API.
const DEFAULT_SOURCE = 'netmirror';
const DEFAULT_PLAYER_URL = 'http://127.0.0.1:3001';

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
  return (process.env.PLAYER_PUBLIC_URL || DEFAULT_PLAYER_URL).replace(/\/+$/, '');
}

function buildPlayerUrl(media) {
  const base = playerBaseUrl();
  const params = new URLSearchParams();
  if (media.poster) params.set('poster', media.poster);
  const qs = params.toString();
  const suffix = qs ? `?${qs}` : '';
  if (media.type === 'tv') {
    return `${base}/tv/${encodeURIComponent(media.id)}/${media.season}/${media.episode}${suffix}`;
  }
  if (media.type === 'live_tv') {
    return `${base}/live/${encodeURIComponent(media.id)}${suffix}`;
  }
  return `${base}/movie/${encodeURIComponent(media.id)}${suffix}`;
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
  const url = buildPlayerUrl(media);

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

module.exports = {
  DEFAULT_SOURCE,
  DEFAULT_PLAYER_URL,
  buildPlayerUrl,
  getEmbed,
};
