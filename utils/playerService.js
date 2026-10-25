// Maps Peak's provider output to the custom player's StreamResponse contract.
// The player UI lives in ./player and is served separately via Docker.
// Peak remains the only source of streams.
const { listProviders, getProvider } = require('../providers/registry');
const { getDetails, resolveImdbId } = require('./tmdb');
const { applyFilters } = require('./streamFilters');
const { processStreamsForProxy } = require('../proxy/proxyServer');

const DEFAULT_SOURCE = 'netmirror';
const PREFERRED_ORDER = ['netmirror','zxcstreams','vaplayer','vixsrc','dahmermovies','vidlink','hdghartv','streamflix'];
const PLAYER_LOGO = '/logo.svg';
const PLAYER_ACCENT = '#2f6b4f';

const EVENT_CACHE_TTL_MS = 3600 * 1000;
const eventCache = new Map();

function lazyIptvStore() {
  try {
    return require('./iptvStore');
  } catch (e) {
    return null;
  }
}

function isCacheEnabled(cfg) {
  return !cfg?.disableCache;
}

function getCachedAggregate(cacheKey) {
  const entry = eventCache.get(cacheKey);
  if (!entry) return null;
  if (Date.now() - entry.ts > EVENT_CACHE_TTL_MS) {
    eventCache.delete(cacheKey);
    return null;
  }
  return entry.data;
}

function setCachedAggregate(cacheKey, data) {
  eventCache.set(cacheKey, { data, ts: Date.now() });
}

function aggregateCacheKey(tmdbType, tmdbId, seasonNumber, episodeNumber) {
  return `events:${tmdbType}:${tmdbId}:${seasonNumber || ''}:${episodeNumber || ''}`;
}

function sortSourcesHlsFirst(sources) {
  return sources.sort((a, b) => {
    if (a.adaptive && !b.adaptive) return -1;
    if (!a.adaptive && b.adaptive) return 1;
    return 0;
  });
}

function normalizeType(type) {
  return String(type || '').toLowerCase() === 'movie' ? 'movie' : 'tv';
}

function providerOrder() {
  const available = listProviders()
    .filter((provider) => provider.enabled)
    .map((provider) => provider.name);
  const ordered = PREFERRED_ORDER.filter((name) => available.includes(name));
  const remaining = available.filter((name) => !PREFERRED_ORDER.includes(name));
  return [...ordered, ...remaining.sort()];
}

function isHlsStream(stream) {
  const url = String(stream?.url || '');
  return (
    stream?.codec === 'hls' ||
    stream?.adaptive === true ||
    /\.m3u8($|\?)/i.test(url) ||
    /\/m3u8-proxy\?/i.test(url)
  );
}

function playerSource(stream) {
  const hls = isHlsStream(stream);
  return {
    url: stream.url,
    quality: stream.quality || stream.title || 'auto',
    codec: hls ? 'hls' : 'mp4',
    provider: stream.provider || 'Peak',
    adaptive: hls,
    expiresIn: 3600,
  };
}

function collectSubtitles(streams) {
  const seen = new Set();
  const subtitles = [];
  for (const stream of streams) {
    for (const subtitle of stream.subtitles || []) {
      if (!subtitle?.url || seen.has(subtitle.url)) continue;
      seen.add(subtitle.url);
      subtitles.push({
        url: subtitle.url,
        lang: subtitle.lang || 'en',
        label: subtitle.label || subtitle.lang || 'Subtitles',
        provider: subtitle.provider || stream.provider || 'Peak',
      });
    }
  }
  return subtitles;
}

async function withTimeout(promise, milliseconds, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out after ${milliseconds}ms`)),
          milliseconds,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function fetchProvider(name, context) {
  const provider = getProvider(name);
  const started = Date.now();
  if (!provider || !provider.enabled) {
    return {
      name,
      streams: [],
      diagnostic: { provider: name, ok: false, latencyMs: 0, error: 'provider disabled' },
    };
  }
  try {
    const streams = await withTimeout(provider.fetch(context), 4000, name);
    return {
      name,
      streams: Array.isArray(streams) ? streams : [],
      diagnostic: { provider: name, ok: true, latencyMs: Date.now() - started },
    };
  } catch (error) {
    return {
      name,
      streams: [],
      diagnostic: {
        provider: name,
        ok: false,
        latencyMs: Date.now() - started,
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

async function getPlayerStream({ type, id, season, episode, serverUrl, config }) {
  if (type === 'live_tv') {
    return getLiveTvStream({ id, serverUrl });
  }

  const tmdbType = normalizeType(type);
  const tmdbId = String(id);
  const seasonNumber = tmdbType === 'tv' ? Number(season) || 1 : null;
  const episodeNumber = tmdbType === 'tv' ? Number(episode) || 1 : null;
  const started = Date.now();
  const cacheKey = aggregateCacheKey(tmdbType, tmdbId, seasonNumber, episodeNumber);

  if (isCacheEnabled(config)) {
    const cached = getCachedAggregate(cacheKey);
    if (cached) {
      const proxied = processStreamsForProxy(cached.streams, serverUrl);
      const sources = proxied.map(playerSource);
      return {
        id: tmdbId,
        type: tmdbType,
        title: cached.meta.title,
        year: cached.meta.year,
        sources,
        subtitles: cached.subtitles,
        meta: {
          latencyMs: Date.now() - started,
          providers: cached.providers,
          sources: sources.length,
          cacheHit: true,
        },
        diagnostics: cached.diagnostics,
      };
    }
  }

  const detailsPromise = getDetails(tmdbType, tmdbId).catch(() => null);
  const imdbId = await resolveImdbId(tmdbType, tmdbId).catch(() => null);
  const context = {
    tmdbId,
    type: tmdbType,
    season: seasonNumber,
    episode: episodeNumber,
    imdbId,
    filters: {},
  };

  const providerResults = await Promise.all(
    providerOrder().map((name) => fetchProvider(name, context)),
  );

  let streams = providerResults.flatMap((result) => result.streams);
  streams = streams.filter(
    (stream) => stream?.url && stream.codec !== 'html5' && stream.type !== 'embed',
  );
  streams = applyFilters(
    streams,
    'aggregate',
    config?.minQualities,
    config?.excludeCodecs,
  );

  const originalStreams = streams.map((stream) => ({ ...stream }));
  const proxied = processStreamsForProxy(originalStreams, serverUrl);
  const sources = proxied.map(playerSource);
  const subtitles = collectSubtitles(originalStreams);
  const details = await detailsPromise;
  const title = details?.title || details?.name || 'Peak';
  const releaseDate = details?.release_date || details?.first_air_date || '';
  const year = releaseDate ? Number(String(releaseDate).slice(0, 4)) || undefined : undefined;

  if (isCacheEnabled(config)) {
    setCachedAggregate(cacheKey, {
      meta: { title, year },
      streams: originalStreams,
      subtitles,
      diagnostics: providerResults.map((result) => result.diagnostic),
      providers: providerResults.length,
    });
  }

  return {
    id: tmdbId,
    type: tmdbType,
    title,
    year,
    sources,
    subtitles,
    meta: {
      latencyMs: Date.now() - started,
      providers: providerResults.length,
      sources: sources.length,
    },
    diagnostics: providerResults.map((result) => result.diagnostic),
  };
}

function getLiveTvStream({ id, serverUrl }) {
  const store = lazyIptvStore();
  if (!store) {
    const err = new Error('IPTV store unavailable');
    err.code = 'IPTV_NOT_AVAILABLE';
    throw err;
  }
  const channel = store.getChannel(String(id));
  if (!channel || !channel.enabled) {
    const err = new Error('CHANNEL_NOT_FOUND');
    err.code = 'CHANNEL_NOT_FOUND';
    throw err;
  }

  const isEmbed = !/\.m3u8/i.test(channel.url);
  let streamUrl = channel.url;
  if (!isEmbed && serverUrl) {
    const proxied = processStreamsForProxy([{ url: channel.url, headers: channel.headers || {} }], serverUrl);
    streamUrl = proxied[0]?.url || channel.url;
  }

  const source = {
    url: streamUrl,
    quality: 'auto',
    codec: isEmbed ? 'html5' : 'hls',
    provider: 'iptv',
    adaptive: !isEmbed,
    expiresIn: 3600,
  };

  return {
    id: channel.id,
    type: 'live_tv',
    title: channel.name,
    group: channel.groupTitle,
    logo: channel.logo,
    sources: [source],
    subtitles: [],
    meta: {
      latencyMs: 0,
      providers: 1,
      sources: 1,
    },
    diagnostics: [{ provider: 'iptv', ok: true, latencyMs: 0 }],
  };
}

async function getPlayerStreamEvents({ type, id, season, episode, serverUrl, config, onEvent, cancelled, invalidate }) {
  const emit = (event, data) => {
    if (cancelled && cancelled.value) return;
    onEvent(event, data);
  };

  if (type === 'live_tv') {
    const started = Date.now();
    try {
      const payload = getLiveTvStream({ id, serverUrl });
      emit('meta', { title: payload.title, group: payload.group, logo: payload.logo });
      for (const source of payload.sources) emit('source', source);
      for (const diag of payload.diagnostics) emit('diagnostic', diag);
      emit('done', {
        meta: {
          providers: 1,
          sources: payload.sources.length,
          subtitles: 0,
          latencyMs: Date.now() - started,
          cacheHit: false,
        },
        diagnostics: payload.diagnostics,
      });
    } catch (e) {
      if (cancelled && cancelled.value) return;
      emit('error', { error: e.code || 'LIVE_TV_ERROR', message: e.message });
    }
    return;
  }

  const tmdbType = normalizeType(type);
  const tmdbId = String(id);
  const seasonNumber = tmdbType === 'tv' ? Number(season) || 1 : null;
   const episodeNumber = tmdbType === 'tv' ? Number(episode) || 1 : null;
  const started = Date.now();
  const cacheKey = aggregateCacheKey(tmdbType, tmdbId, seasonNumber, episodeNumber);

  if (isCacheEnabled(config)) {
    if (invalidate) {
      eventCache.delete(cacheKey);
    }
    const cached = getCachedAggregate(cacheKey);
    if (cached) {
      emit('meta', cached.meta);
      const proxied = processStreamsForProxy(cached.streams, serverUrl);
      const order = providerOrder();
      const sources = proxied.map(playerSource).map((s) => ({
        ...s,
        _order: order.indexOf(s.provider?.toLowerCase()) ?? -1,
      }));
      const mp4First = sources
        .filter((s) => s.codec === 'mp4')
        .sort((a, b) => (a._order === -1 ? 999 : a._order) - (b._order === -1 ? 999 : b._order));
      const hlsFirst = sources
        .filter((s) => s.codec !== 'mp4')
        .sort((a, b) => (a._order === -1 ? 999 : a._order) - (b._order === -1 ? 999 : b._order));
      for (const source of [...mp4First, ...hlsFirst]) {
        const { _order, ...s } = source;
        emit('source', s);
      }
      for (const subtitle of cached.subtitles) emit('subtitle', subtitle);
      for (const diag of cached.diagnostics) emit('diagnostic', diag);
      emit('done', {
        meta: {
          providers: cached.providers,
          sources: sources.length,
          subtitles: cached.subtitles.length,
          latencyMs: Date.now() - started,
          cacheHit: true,
        },
        diagnostics: cached.diagnostics,
      });
      return;
    }
  }

  const detailsPromise = getDetails(tmdbType, tmdbId).catch(() => null);
  const imdbId = await resolveImdbId(tmdbType, tmdbId).catch(() => null);

  const context = {
    tmdbId,
    type: tmdbType,
    season: seasonNumber,
    episode: episodeNumber,
    imdbId,
    filters: {},
  };

  const order = providerOrder();
  const allOriginalStreams = [];
  const allSources = [];
  const diagnostics = [];
  const collectedSubtitles = [];
  const seenSubtitles = new Set();
  let metaEmitted = false;

  const scrapePromises = order.map(async (name) => {
    const result = await fetchProvider(name, context);
    if (cancelled && cancelled.value) return;

    diagnostics.push(result.diagnostic);
    emit('diagnostic', result.diagnostic);

    let streams = result.streams.filter(
      (stream) => stream?.url && stream.codec !== 'html5' && stream.type !== 'embed',
    );
    streams = applyFilters(streams, name, config?.minQualities, config?.excludeCodecs);

    const subs = collectSubtitles(streams);
    for (const sub of subs) {
      if (!seenSubtitles.has(sub.url)) {
        seenSubtitles.add(sub.url);
        collectedSubtitles.push(sub);
        emit('subtitle', sub);
      }
    }

    const originalStreams = streams.map((stream) => ({ ...stream }));
    allOriginalStreams.push(...originalStreams);
    const proxied = processStreamsForProxy(originalStreams, serverUrl);
    const sources = proxied.map(playerSource);

    const providerOrderIdx = order.indexOf(name);
    for (const source of sources) {
      const withOrder = { ...source, _order: providerOrderIdx };
      allSources.push(withOrder);
      emit('source', source);
    }
  });

  const details = await detailsPromise;
  const title = details?.title || details?.name || 'Peak';
  const releaseDate = details?.release_date || details?.first_air_date || '';
  const year = releaseDate ? Number(String(releaseDate).slice(0, 4)) || undefined : undefined;
  if (!metaEmitted) {
    emit('meta', { title, year });
    metaEmitted = true;
  }

  await Promise.all(scrapePromises);

  if (cancelled && !cancelled.value) {
    setCachedAggregate(cacheKey, {
      meta: { title, year },
      streams: allOriginalStreams,
      subtitles: collectedSubtitles,
      diagnostics,
      providers: order.length,
      latencyMs: Date.now() - started,
    });
  }

  const latencyMs = Date.now() - started;
  emit('done', {
    meta: {
      providers: order.length,
      sources: allOriginalStreams.length,
      subtitles: collectedSubtitles.length,
      latencyMs,
      cacheHit: false,
    },
    diagnostics,
  });
}

function getBranding() {
  return {
    name: 'Peak',
    logoUrl: PLAYER_LOGO,
    accentColor: PLAYER_ACCENT,
    tagline: 'Cinema, elevated.',
  };
}

function getPlayerProviders() {
  return {
    providers: providerOrder().map((name, order) => ({
      id: name,
      name,
      enabled: true,
      order,
    })),
  };
}

module.exports = {
  DEFAULT_SOURCE,
  getBranding,
  getPlayerProviders,
  getPlayerStream,
  getPlayerStreamEvents,
  getLiveTvStream,
  normalizeType,
  providerOrder,
};
