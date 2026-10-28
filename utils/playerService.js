// Maps Peak's provider output to the custom player's StreamResponse contract.
// The player UI lives in ./player and is served separately via Docker.
// Peak remains the only source of streams.
const { listProviders, getProvider } = require('../providers/registry');
const { resolveImdbId } = require('./tmdb');
const { fetchExternalSubtitles, mergeSubtitles } = require('./subtitleSources');
const { getMedia } = require('./mediaResolver');
const { applyFilters } = require('./streamFilters');
const { buildPlayerSource } = require('./sourceMetadata');
const { rankSources } = require('./sourceRanking');
const { validateSource } = require('./sourceValidator');
const { recordProviderResult } = require('./providerHealth');
const { processStreamsForProxy } = require('../proxy/proxyServer');
const { config } = require('./config');

const DEFAULT_SOURCE = 'netmirror';
const PREFERRED_ORDER = ['netmirror','zxcstreams','vaplayer','vixsrc','dahmermovies','vidlink','hdghartv','streamflix'];
const PLAYER_LOGO = '/logo.svg';
// The player is always rendered on a black stage, so the monochrome AMOLED
// accent is the dark-theme token value rather than the light-theme #333333.
const PLAYER_ACCENT = '#e5e5e5';

const DEFAULT_CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_CACHE_TTL_MS = 30 * 60 * 1000;
const eventCache = new Map();

// Config values arrive from env as strings ("false", "0") or as booleans from
// the JSON override file. Normalise both so branding never reports autoplay on
// when the operator disabled it.
function asBoolean(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  return fallback;
}

function lazyIptvStore() {
  try {
    return require('./iptvStore');
  } catch (e) {
    return null;
  }
}

function cacheTtlMs(cfg) {
  if (cfg?.disableCache) return 0;
  const raw = cfg?.playerCacheTtlMs ?? process.env.PLAYER_CACHE_TTL_MS;
  if (raw === undefined || raw === null || raw === '') return DEFAULT_CACHE_TTL_MS;
  const value = Number(raw);
  if (!Number.isFinite(value)) return DEFAULT_CACHE_TTL_MS;
  if (value <= 0) return 0;
  return Math.min(Math.floor(value), MAX_CACHE_TTL_MS);
}

function getCachedAggregate(cacheKey, ttlMs = cacheTtlMs()) {
  if (ttlMs <= 0) return null;
  const entry = eventCache.get(cacheKey);
  if (!entry) return null;
  if (Date.now() - entry.ts > ttlMs) {
    eventCache.delete(cacheKey);
    return null;
  }
  return entry.data;
}

function setCachedAggregate(cacheKey, data) {
  eventCache.set(cacheKey, { data, ts: Date.now() });
}

function clearEventCache() {
  eventCache.clear();
}

function aggregateCacheKey(tmdbType, tmdbId, seasonNumber, episodeNumber, source = '') {
  const season = seasonNumber ?? '';
  const episode = episodeNumber ?? '';
  const selectedSource = source ?? '';
  return `events:${tmdbType}:${tmdbId}:${season}:${episode}:${selectedSource}`;
}

function mediaFallback(type, id) {
  return {
    id,
    type,
    title: 'Untitled',
    year: null,
    overview: null,
    tagline: null,
    runtime: null,
    genres: [],
    rating: null,
    poster: { candidates: [] },
    backdrop: null,
    stills: [],
    seriesPoster: null,
    source: 'generated',
  };
}

// The stream contract exposes the resolver record minus `seriesPoster`, which
// is series-level artwork and belongs to the future artwork pipeline.
function publicMedia(media) {
  if (!media || typeof media !== 'object') return undefined;
  const { seriesPoster, ...rest } = media;
  return rest;
}

async function resolveStreamMedia(getMediaImpl, input) {
  try {
    const result = await getMediaImpl(input);
    const media = result && result.media;
    return media && typeof media === 'object' ? media : mediaFallback(input.type, input.id);
  } catch {
    return mediaFallback(input.type, input.id);
  }
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

// A selected source narrows the provider order to exactly that provider. An
// unknown or disabled source is rejected instead of silently falling back to
// the full provider list.
function selectedProviderOrder(order, source) {
  if (source === undefined || source === null) return order;
  if (!order.includes(source)) {
    const error = new Error('INVALID_SOURCE');
    error.code = 'INVALID_SOURCE';
    throw error;
  }
  return [source];
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

function proxyForPlayer(stream, serverUrl) {
  if (!serverUrl) return stream;
  const proxied = processStreamsForProxy([stream], serverUrl);
  return proxied[0] || stream;
}

async function prepareStreams(streams, options = {}) {
  const {
    serverUrl,
    config,
    order,
    allowPrivate = false,
    validate = validateSource,
    expiresIn,
    onRejected,
  } = options;
  const ttlMs = cacheTtlMs(config);
  const expires = Number.isFinite(expiresIn)
    ? expiresIn
    : Math.max(60, Math.floor((ttlMs || DEFAULT_CACHE_TTL_MS) / 1000));
  const candidates = (Array.isArray(streams) ? streams : []).filter(
    (stream) => stream?.url && stream.codec !== 'html5' && stream.type !== 'embed',
  );

  const prepared = await mapLimit(candidates, 6, async (stream) => {
    let result;
    try {
      result = await validate(stream, { allowPrivate });
    } catch (error) {
      result = { ok: false, reason: error instanceof Error ? error.message : String(error) };
    }
    if (!result?.ok) {
      if (typeof onRejected === 'function') onRejected(stream, result);
      return null;
    }
    const source = buildPlayerSource(proxyForPlayer(stream, serverUrl), { expiresIn: expires });
    if (Number.isFinite(stream._order)) source._order = stream._order;
    else if (Number.isFinite(order)) source._order = order;
    return source;
  });

  return rankSources(prepared.filter(Boolean));
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
    const latencyMs = Date.now() - started;
    recordProviderResult(name, { ok: true, latencyMs });
    return {
      name,
      streams: Array.isArray(streams) ? streams : [],
      diagnostic: { provider: name, ok: true, latencyMs },
    };
  } catch (error) {
    const latencyMs = Date.now() - started;
    const message = error instanceof Error ? error.message : String(error);
    recordProviderResult(name, { ok: false, latencyMs, error: message });
    return {
      name,
      streams: [],
      diagnostic: {
        provider: name,
        ok: false,
        latencyMs,
        error: message,
      },
    };
  }
}

async function getPlayerStream({ type, id, season, episode, source, serverUrl, config, deps = {} }) {
  const providerOrderImpl = deps.providerOrder || providerOrder;
  const fetchProviderImpl = deps.fetchProvider || fetchProvider;
  const prepareStreamsImpl = deps.prepareStreams || prepareStreams;
  const getMediaImpl = deps.getMedia || getMedia;
  const resolveImdbIdImpl = deps.resolveImdbId || resolveImdbId;
  const order = selectedProviderOrder(providerOrderImpl(), source);
  if (type === 'live_tv') {
    return getLiveTvStream({ id, serverUrl });
  }

  const tmdbType = normalizeType(type);
  const tmdbId = String(id);
  const seasonNumber = tmdbType === 'tv' ? Number(season) || 1 : null;
  const episodeNumber = tmdbType === 'tv' ? Number(episode) || 1 : null;
  const started = Date.now();
  const cacheKey = aggregateCacheKey(tmdbType, tmdbId, seasonNumber, episodeNumber, source);
  const ttlMs = cacheTtlMs(config);
  const allowPrivate = config?.allowPrivateSources === true;

  if (ttlMs > 0) {
    const cached = getCachedAggregate(cacheKey, ttlMs);
    if (cached) {
      const sources = await prepareStreamsImpl(cached.streams, {
        serverUrl,
        config,
        allowPrivate,
      });
      if (sources.length) {
        return {
          id: tmdbId,
          type: tmdbType,
          title: cached.meta.title,
          year: cached.meta.year,
          media: cached.media,
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
      eventCache.delete(cacheKey);
    }
  }

  // Media resolution starts alongside provider scraping: it has its own 4 s
  // stage budgets and must not add serial latency to the first byte.
  const mediaPromise = resolveStreamMedia(getMediaImpl, {
    type: tmdbType,
    id: tmdbId,
    season: seasonNumber,
    episode: episodeNumber,
  });
  const imdbId = await resolveImdbIdImpl(tmdbType, tmdbId).catch(() => null);
  const externalSubtitlesPromise = fetchExternalSubtitles({
    imdbId,
    type: tmdbType,
    season: seasonNumber,
    episode: episodeNumber,
  }).catch(() => []);
  const context = {
    tmdbId,
    type: tmdbType,
    season: seasonNumber,
    episode: episodeNumber,
    imdbId,
    filters: {},
  };

  const providerResults = await Promise.all(
    order.map((name) => fetchProviderImpl(name, context)),
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
  const orderIndex = new Map(order.map((name, index) => [name, index]));
  streams = streams.map((stream) => ({
    ...stream,
    _order: orderIndex.get(String(stream.provider || '').toLowerCase()) ?? 999,
  }));

  const sourceDiagnostics = [];
  const originalStreams = streams.map((stream) => ({ ...stream }));
  const sources = await prepareStreamsImpl(streams, {
    serverUrl,
    config,
    allowPrivate,
    onRejected: (stream, result) => {
      sourceDiagnostics.push({
        provider: stream.provider || 'aggregate',
        ok: false,
        latencyMs: 0,
        error: `source rejected: ${result?.reason || result?.status || 'invalid'}`,
        kind: 'source',
      });
    },
  });
  const subtitles = mergeSubtitles(
    collectSubtitles(originalStreams),
    await externalSubtitlesPromise,
  );
  const diagnostics = [
    ...providerResults.map((result) => result.diagnostic),
    ...sourceDiagnostics,
  ];
  const media = await mediaPromise;
  const mediaRecord = publicMedia(media);
  const title = media.title || 'Untitled';
  const year = media.year ?? undefined;

  if (ttlMs > 0) {
    setCachedAggregate(cacheKey, {
      meta: { title, year },
      media: mediaRecord,
      streams: originalStreams,
      subtitles,
      diagnostics,
      providers: providerResults.length,
    });
  }

  return {
    id: tmdbId,
    type: tmdbType,
    title,
    year,
    media: mediaRecord,
    sources,
    subtitles,
    meta: {
      latencyMs: Date.now() - started,
      providers: providerResults.length,
      sources: sources.length,
    },
    diagnostics,
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

async function getPlayerStreamEvents({
  type,
  id,
  season,
  episode,
  source,
  serverUrl,
  config,
  onEvent,
  cancelled,
  invalidate,
  embed = false,
  deps = {},
}) {
  const fetchProviderImpl = deps.fetchProvider || fetchProvider;
  const providerOrderImpl = deps.providerOrder || providerOrder;
  const prepareStreamsImpl = deps.prepareStreams || prepareStreams;
  const getMediaImpl = deps.getMedia || getMedia;
  const resolveImdbIdImpl = deps.resolveImdbId || resolveImdbId;
  const getLiveTvStreamImpl = deps.getLiveTvStream || getLiveTvStream;
  const order = selectedProviderOrder(providerOrderImpl(), source);
  const emit = (event, data) => {
    if (cancelled && cancelled.value) return;
    onEvent(event, data);
  };

  if (type === 'live_tv') {
    const started = Date.now();
    try {
      const payload = getLiveTvStreamImpl({ id, serverUrl });
      const sources = embed
        ? payload.sources.filter((source) => source.codec !== 'html5')
        : payload.sources;
      emit('meta', { title: payload.title, group: payload.group, logo: payload.logo });
      if (embed && sources.length === 0) {
        const diagnostic = {
          provider: 'iptv',
          ok: false,
          latencyMs: 0,
          error: 'external live channel is disabled in embeds',
        };
        emit('diagnostic', diagnostic);
        emit('error', {
          error: 'NO_EMBEDDABLE_SOURCE',
          message: 'This live channel needs an external player and is unavailable in embeds.',
        });
        return;
      }
      for (const source of sources) emit('source', source);
      for (const diag of payload.diagnostics) emit('diagnostic', diag);
      emit('done', {
        meta: {
          providers: 1,
          sources: sources.length,
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
  const cacheKey = aggregateCacheKey(tmdbType, tmdbId, seasonNumber, episodeNumber, source);
  const ttlMs = cacheTtlMs(config);
  const allowPrivate = config?.allowPrivateSources === true;

  if (ttlMs > 0) {
    if (invalidate) {
      eventCache.delete(cacheKey);
    }
    const cached = getCachedAggregate(cacheKey, ttlMs);
    if (cached) {
      const sources = await prepareStreamsImpl(cached.streams, {
        serverUrl,
        config,
        allowPrivate,
      });
      if (sources.length) {
        emit('meta', { ...cached.meta, media: cached.media });
        for (const source of sources) {
          const { _order, ...publicSource } = source;
          emit('source', publicSource);
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
      eventCache.delete(cacheKey);
    }
  }

  // Media resolution runs alongside provider scraping; the meta event is emitted
  // as soon as the record is ready, without waiting for the slowest provider.
  const mediaPromise = resolveStreamMedia(getMediaImpl, {
    type: tmdbType,
    id: tmdbId,
    season: seasonNumber,
    episode: episodeNumber,
  });
  const imdbId = await resolveImdbIdImpl(tmdbType, tmdbId).catch(() => null);
  const externalSubtitlesPromise = fetchExternalSubtitles({
    imdbId,
    type: tmdbType,
    season: seasonNumber,
    episode: episodeNumber,
  }).catch(() => []);

  const context = {
    tmdbId,
    type: tmdbType,
    season: seasonNumber,
    episode: episodeNumber,
    imdbId,
    filters: {},
  };

  const allOriginalStreams = [];
  const allSources = [];
  const diagnostics = [];
  const collectedSubtitles = [];
  const seenSubtitles = new Set();
  let metaEmitted = false;

  const scrapePromises = order.map(async (name) => {
    const result = await fetchProviderImpl(name, context);
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
    const providerOrderIdx = order.indexOf(name);
    const sources = await prepareStreamsImpl(originalStreams, {
      serverUrl,
      config,
      allowPrivate,
      order: providerOrderIdx,
      onRejected: (stream, validation) => {
        const diagnostic = {
          provider: name,
          ok: false,
          latencyMs: 0,
          error: `source rejected: ${validation?.reason || validation?.status || 'invalid'}`,
          kind: 'source',
        };
        diagnostics.push(diagnostic);
        emit('diagnostic', diagnostic);
      },
    });
    if (cancelled && cancelled.value) return;

    for (const source of sources) {
      allSources.push(source);
      const { _order, ...publicSource } = source;
      emit('source', publicSource);
    }
  });

  const media = await mediaPromise;
  const mediaRecord = publicMedia(media);
  const title = media.title || 'Untitled';
  const year = media.year ?? undefined;
  if (!metaEmitted) {
    emit('meta', { title, year, media: mediaRecord });
    metaEmitted = true;
  }

  await Promise.all(scrapePromises);

  for (const sub of await externalSubtitlesPromise) {
    if (cancelled && cancelled.value) break;
    if (seenSubtitles.has(sub.url)) continue;
    seenSubtitles.add(sub.url);
    collectedSubtitles.push(sub);
    emit('subtitle', sub);
  }

  if (ttlMs > 0 && !(cancelled && cancelled.value)) {
    setCachedAggregate(cacheKey, {
      meta: { title, year },
      media: mediaRecord,
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
      sources: allSources.length,
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
    preferences: {
      autoplay: asBoolean(config.autoplay, true),
      autoplayMuted: asBoolean(config.autoplayMuted, true),
    },
    preferenceMode: config.playerPreferenceMode || process.env.PLAYER_PREFERENCE_MODE || 'browser',
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
  aggregateCacheKey,
  cacheTtlMs,
  clearEventCache,
  getBranding,
  getPlayerProviders,
  getPlayerStream,
  getPlayerStreamEvents,
  getLiveTvStream,
  normalizeType,
  prepareStreams,
  providerOrder,
};
