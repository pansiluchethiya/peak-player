'use strict';

const assert = require('node:assert/strict');
const { beforeEach, describe, it } = require('node:test');
const {
  cacheTtlMs,
  clearEventCache,
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

async function runEvents({ deps = {}, config = { playerCacheTtlMs: 900000 } } = {}) {
  const sink = collector();
  await getPlayerStreamEvents({
    type: 'movie',
    id: '550',
    serverUrl: 'http://peak.test',
    config,
    onEvent: sink.onEvent,
    cancelled: { value: false },
    deps: {
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

describe('cacheTtlMs', () => {
  it('defaults to 15 minutes, caps at 30 minutes, and can be disabled', () => {
    assert.equal(cacheTtlMs({}), 900000);
    assert.equal(cacheTtlMs({ playerCacheTtlMs: 999999999 }), 1800000);
    assert.equal(cacheTtlMs({ disableCache: true }), 0);
  });
});
