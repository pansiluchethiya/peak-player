'use strict';

const assert = require('node:assert/strict');
const { beforeEach, describe, it } = require('node:test');
const {
  aggregateCacheKey,
  cacheTtlMs,
  clearEventCache,
  getPlayerStream,
  getPlayerStreamEvents,
  prepareStreams,
} = require('../utils/playerService');

function hls(overrides = {}) {
  return {
    url: 'https://cdn.example/movie/master.m3u8',
    quality: '1080p',
    provider: 'alpha',
    codec: 'hls',
    ...overrides,
  };
}

function mp4(overrides = {}) {
  return {
    url: 'https://cdn.example/movie/1080.mp4',
    quality: '1080p',
    provider: 'alpha',
    codec: 'mp4',
    ...overrides,
  };
}

function mediaRecord(overrides = {}) {
  return {
    id: '550',
    type: 'movie',
    title: 'Media Title',
    year: 1999,
    overview: 'A media overview.',
    tagline: null,
    runtime: 139,
    genres: ['Drama'],
    rating: 8.4,
    poster: { candidates: ['https://image.example/poster.jpg'] },
    backdrop: null,
    stills: [],
    seriesPoster: 'https://image.example/series.jpg',
    source: 'wikipedia',
    ...overrides,
  };
}

function validate(stream) {
  if (stream.dead) return { ok: false, status: 403, reason: 'http 403' };
  return {
    ok: true,
    status: 206,
    container: stream.codec === 'hls' ? 'hls' : 'mp4',
  };
}

function prepare(streams, options = {}) {
  return prepareStreams(streams, { ...options, validate });
}

function collector() {
  const events = [];
  return {
    events,
    onEvent(event, data) {
      events.push({ event, data });
    },
  };
}

async function runEvents({ deps = {}, config = { playerCacheTtlMs: 900000 }, source } = {}) {
  const sink = collector();
  await getPlayerStreamEvents({
    type: 'movie',
    id: '550',
    source,
    serverUrl: 'http://peak.test',
    config,
    onEvent: sink.onEvent,
    cancelled: { value: false },
    deps: {
      getMedia: async () => ({ media: mediaRecord(), cacheHit: false }),
      getDetails: async () => ({ title: 'Test Movie', release_date: '1999-01-01' }),
      resolveImdbId: async () => null,
      providerOrder: () => ['alpha'],
      fetchProvider: async () => ({
        name: 'alpha',
        streams: [hls(), mp4()],
        diagnostic: { provider: 'alpha', ok: true, latencyMs: 1 },
      }),
      prepareStreams: prepare,
      ...deps,
    },
  });
  return sink.events;
}

beforeEach(() => {
  clearEventCache();
});

describe('prepareStreams', () => {
  it('rejects dead sources, never emits MKV as the first source, and reports rejections', async () => {
    const rejected = [];
    const sources = await prepareStreams(
      [mp4({ url: 'https://cdn.example/movie/2160.mkv', quality: '2160p', codec: 'mkv' }), hls(), mp4({ dead: true })],
      {
        serverUrl: 'http://peak.test',
        config: { playerCacheTtlMs: 900000 },
        validate,
        onRejected: (stream, result) => rejected.push({ stream, result }),
      },
    );

    assert.equal(sources.length, 2);
    assert.equal(sources[0].container, 'hls');
    assert.equal(sources[0].codec, 'hls');
    assert.equal(rejected.length, 1);
    assert.equal(rejected[0].result.reason, 'http 403');
  });

  it('uses the configured cache lifetime for source expiry', async () => {
    const sources = await prepareStreams([hls()], {
      serverUrl: 'http://peak.test',
      config: { playerCacheTtlMs: 1200000 },
      validate,
    });
    assert.equal(sources[0].expiresIn, 1200);
  });
});

describe('getPlayerStreamEvents', () => {
  it('emits only validated sources and records source rejection diagnostics', async () => {
    const events = await runEvents({
      deps: {
        fetchProvider: async () => ({
          name: 'alpha',
          streams: [hls(), mp4({ dead: true })],
          diagnostic: { provider: 'alpha', ok: true, latencyMs: 1 },
        }),
      },
    });

    const sources = events.filter((entry) => entry.event === 'source').map((entry) => entry.data);
    assert.equal(sources.length, 1);
    assert.equal(sources[0].codec, 'hls');

    const rejection = events.find(
      (entry) => entry.event === 'diagnostic' && String(entry.data.error).startsWith('source rejected'),
    );
    assert.ok(rejection);
    assert.equal(rejection.data.provider, 'alpha');
  });

  it('ranks HLS before MP4 within a provider', async () => {
    const events = await runEvents({
      deps: {
        fetchProvider: async () => ({
          name: 'alpha',
          streams: [mp4(), hls()],
          diagnostic: { provider: 'alpha', ok: true, latencyMs: 1 },
        }),
      },
    });

    const sources = events.filter((entry) => entry.event === 'source').map((entry) => entry.data);
    assert.deepEqual(
      sources.map((source) => source.codec),
      ['hls', 'mp4'],
    );
  });

  it('queries only the selected provider and rejects an unknown source', async () => {
    const queried = [];
    const deps = {
      providerOrder: () => ['alpha', 'beta'],
      fetchProvider: async (name) => {
        queried.push(name);
        return {
          name,
          streams: [hls({ provider: name })],
          diagnostic: { provider: name, ok: true, latencyMs: 1 },
        };
      },
    };

    await runEvents({ deps, source: 'beta' });
    assert.deepEqual(queried, ['beta']);

    await assert.rejects(
      runEvents({ deps, source: 'missing' }),
      (error) => error.code === 'INVALID_SOURCE',
    );
    assert.deepEqual(queried, ['beta']);
  });

  it('rejects an empty selected source instead of fanning out', async () => {
    const queried = [];
    await assert.rejects(
      runEvents({
        source: '',
        deps: {
          providerOrder: () => ['alpha', 'beta'],
          fetchProvider: async (name) => {
            queried.push(name);
            return {
              name,
              streams: [hls({ provider: name })],
              diagnostic: { provider: name, ok: true, latencyMs: 1 },
            };
          },
        },
      }),
      (error) => error.code === 'INVALID_SOURCE',
    );
    assert.deepEqual(queried, []);
  });

  it('replays cached sources through the same ranking path and marks cacheHit', async () => {
    let fetches = 0;
    const deps = {
      fetchProvider: async () => {
        fetches += 1;
        return {
          name: 'alpha',
          streams: [mp4(), hls()],
          diagnostic: { provider: 'alpha', ok: true, latencyMs: 1 },
        };
      },
    };

    const first = await runEvents({ deps });
    assert.equal(first.find((entry) => entry.event === 'done').data.meta.cacheHit, false);

    const second = await runEvents({ deps });
    assert.equal(fetches, 1);
    const sources = second.filter((entry) => entry.event === 'source').map((entry) => entry.data);
    assert.deepEqual(
      sources.map((source) => source.codec),
      ['hls', 'mp4'],
    );
    assert.equal(second.find((entry) => entry.event === 'done').data.meta.cacheHit, true);
  });

  it('uses the resolved media for the meta event and omits seriesPoster', async () => {
    const events = await runEvents();
    const meta = events.find((entry) => entry.event === 'meta').data;

    assert.equal(meta.title, 'Media Title');
    assert.equal(meta.year, 1999);
    assert.equal(meta.media.source, 'wikipedia');
    assert.equal(meta.media.title, 'Media Title');
    assert.equal('seriesPoster' in meta.media, false);
    assert.notEqual(meta.title, 'Peak');
  });

  it('stores resolved media in the aggregate cache and does not re-resolve it', async () => {
    let mediaCalls = 0;
    const deps = {
      getMedia: async () => {
        mediaCalls += 1;
        return { media: mediaRecord(), cacheHit: false };
      },
    };

    await runEvents({ deps });
    const second = await runEvents({ deps });
    const meta = second.find((entry) => entry.event === 'meta').data;

    assert.equal(mediaCalls, 1);
    assert.equal(meta.title, 'Media Title');
    assert.equal(meta.media.source, 'wikipedia');
  });

  it('still streams an Untitled generated record when media resolution fails', async () => {
    const events = await runEvents({
      deps: {
        getMedia: async () => {
          throw new Error('media offline');
        },
      },
    });
    const meta = events.find((entry) => entry.event === 'meta').data;

    assert.equal(meta.title, 'Untitled');
    assert.equal(meta.media.title, 'Untitled');
    assert.equal(meta.media.source, 'generated');
    assert.deepEqual(meta.media.poster.candidates, []);
    assert.equal('seriesPoster' in meta.media, false);
    assert.ok(events.some((entry) => entry.event === 'source'));
  });

  it('falls back to a fresh scrape when every cached source is rejected', async () => {
    let prepareCalls = 0;
    const deps = {
      fetchProvider: async () => ({
        name: 'alpha',
        streams: [hls()],
        diagnostic: { provider: 'alpha', ok: true, latencyMs: 1 },
      }),
      prepareStreams: (streams, options) => {
        prepareCalls += 1;
        if (prepareCalls === 2) return Promise.resolve([]);
        return prepare(streams, options);
      },
    };

    await runEvents({ deps });
    const second = await runEvents({ deps });
    assert.equal(prepareCalls, 3);
    const done = second.find((entry) => entry.event === 'done').data;
    assert.equal(done.meta.cacheHit, false);
    assert.equal(done.meta.sources, 1);
  });

  it('strips external live iframe sources from embed event streams', async () => {
    const sink = collector();
    await getPlayerStreamEvents({
      type: 'live_tv',
      id: 'channel_demo_abc',
      serverUrl: 'http://peak.test',
      config: {},
      onEvent: sink.onEvent,
      cancelled: { value: false },
      embed: true,
      deps: {
        getLiveTvStream: () => ({
          title: 'News',
          group: 'News',
          logo: '',
          sources: [
            {
              url: 'https://cdn.example/live.m3u8',
              quality: 'auto',
              codec: 'hls',
              provider: 'iptv',
              adaptive: true,
              expiresIn: 3600,
            },
            {
              url: 'https://third-party.example/embed/123',
              quality: 'auto',
              codec: 'html5',
              provider: 'iptv',
              adaptive: false,
              expiresIn: 3600,
            },
          ],
          diagnostics: [{ provider: 'iptv', ok: true, latencyMs: 0 }],
        }),
      },
    });

    const sources = sink.events.filter((entry) => entry.event === 'source').map((entry) => entry.data);
    assert.equal(sources.length, 1);
    assert.equal(sources[0].codec, 'hls');
    assert.equal(JSON.stringify(sink.events).includes('third-party.example'), false);
  });

  it('rejects an external-only live channel in embed mode without leaking its URL', async () => {
    const sink = collector();
    await getPlayerStreamEvents({
      type: 'live_tv',
      id: 'channel_demo_abc',
      serverUrl: 'http://peak.test',
      config: {},
      onEvent: sink.onEvent,
      cancelled: { value: false },
      embed: true,
      deps: {
        getLiveTvStream: () => ({
          title: 'News',
          group: 'News',
          logo: '',
          sources: [
            {
              url: 'https://third-party.example/embed/123',
              quality: 'auto',
              codec: 'html5',
              provider: 'iptv',
              adaptive: false,
              expiresIn: 3600,
            },
          ],
          diagnostics: [{ provider: 'iptv', ok: true, latencyMs: 0 }],
        }),
      },
    });

    assert.equal(sink.events.some((entry) => entry.event === 'source'), false);
    assert.equal(
      sink.events.find((entry) => entry.event === 'error')?.data.error,
      'NO_EMBEDDABLE_SOURCE',
    );
    assert.equal(JSON.stringify(sink.events).includes('third-party.example'), false);
  });
});

describe('getPlayerStream', () => {
  it('queries only the selected provider and isolates the cache key', async () => {
    const queried = [];
    const deps = {
      providerOrder: () => ['alpha', 'beta'],
      fetchProvider: async (name) => {
        queried.push(name);
        return {
          name,
          streams: [hls({ provider: name })],
          diagnostic: { provider: name, ok: true, latencyMs: 1 },
        };
      },
      getMedia: async () => ({ media: mediaRecord(), cacheHit: false }),
      getDetails: async () => ({ title: 'Test Movie', release_date: '1999-01-01' }),
      resolveImdbId: async () => null,
      prepareStreams: prepare,
    };
    const request = {
      type: 'movie',
      id: '550',
      serverUrl: 'http://peak.test',
      config: { playerCacheTtlMs: 900000 },
      deps,
    };

    const selected = await getPlayerStream({ ...request, source: 'beta' });
    assert.deepEqual(queried, ['beta']);
    assert.deepEqual(selected.sources.map((source) => source.provider), ['beta']);

    const unfiltered = await getPlayerStream(request);
    assert.deepEqual(queried, ['beta', 'alpha', 'beta']);
    assert.deepEqual(
      unfiltered.sources.map((source) => source.provider).sort(),
      ['alpha', 'beta'],
    );

    assert.notEqual(
      aggregateCacheKey('movie', '550', null, null, 'beta'),
      aggregateCacheKey('movie', '550', null, null),
    );
    assert.equal(
      aggregateCacheKey('movie', '550', null, null, null),
      aggregateCacheKey('movie', '550', null, null),
    );
  });

  it('returns resolved media and keeps it across aggregate cache hits', async () => {
    let mediaCalls = 0;
    const deps = {
      providerOrder: () => ['alpha'],
      fetchProvider: async () => ({
        name: 'alpha',
        streams: [hls()],
        diagnostic: { provider: 'alpha', ok: true, latencyMs: 1 },
      }),
      resolveImdbId: async () => null,
      prepareStreams: prepare,
      getMedia: async () => {
        mediaCalls += 1;
        return { media: mediaRecord(), cacheHit: false };
      },
    };
    const request = {
      type: 'movie',
      id: '550',
      serverUrl: 'http://peak.test',
      config: { playerCacheTtlMs: 900000 },
      deps,
    };

    const first = await getPlayerStream(request);
    assert.equal(first.title, 'Media Title');
    assert.equal(first.year, 1999);
    assert.equal(first.media.source, 'wikipedia');
    assert.equal('seriesPoster' in first.media, false);
    assert.notEqual(first.title, 'Peak');

    const second = await getPlayerStream(request);
    assert.equal(mediaCalls, 1);
    assert.equal(second.title, 'Media Title');
    assert.equal(second.media.source, 'wikipedia');
    assert.equal(second.meta.cacheHit, true);
  });
});

describe('cacheTtlMs', () => {
  it('defaults to 15 minutes, caps at 30 minutes, and can be disabled', () => {
    assert.equal(cacheTtlMs({}), 900000);
    assert.equal(cacheTtlMs({ playerCacheTtlMs: 999999999 }), 1800000);
    assert.equal(cacheTtlMs({ disableCache: true }), 0);
  });
});
