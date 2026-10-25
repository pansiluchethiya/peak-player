'use strict';

const assert = require('node:assert/strict');
const { beforeEach, describe, it } = require('node:test');
const { rankSources, sourceScore } = require('../utils/sourceRanking');
const { recordProviderResult, resetProviderHealth } = require('../utils/providerHealth');

function source(overrides = {}) {
  return {
    provider: 'test',
    quality: '1080p',
    container: 'mp4',
    videoCodec: 'h264',
    browserPlayable: true,
    adaptive: false,
    ...overrides,
  };
}

describe('source ranking', () => {
  beforeEach(() => resetProviderHealth());

  it('prefers HLS over MP4 and MP4 over MKV', () => {
    const ranked = rankSources([
      source({ url: 'mkv', container: 'mkv', codec: 'mkv', browserPlayable: false }),
      source({ url: 'mp4' }),
      source({ url: 'hls', container: 'hls', codec: 'hls', adaptive: true }),
    ]);
    assert.deepEqual(
      ranked.map((item) => item.url),
      ['hls', 'mp4', 'mkv'],
    );
  });

  it('prefers H.264 over HEVC at the same container and quality', () => {
    const ranked = rankSources([
      source({ url: 'hevc', videoCodec: 'hevc', browserPlayable: false }),
      source({ url: 'h264', videoCodec: 'h264' }),
    ]);
    assert.deepEqual(
      ranked.map((item) => item.url),
      ['h264', 'hevc'],
    );
  });

  it('prefers 1080p over 4K for the web', () => {
    const ranked = rankSources([
      source({ url: '4k', quality: '2160p' }),
      source({ url: '1080', quality: '1080p' }),
      source({ url: '720', quality: '720p' }),
    ]);
    assert.deepEqual(
      ranked.map((item) => item.url),
      ['1080', '720', '4k'],
    );
  });

  it('uses provider health as a tiebreaker', () => {
    recordProviderResult('healthy', { ok: true, latencyMs: 50 });
    recordProviderResult('unhealthy', { ok: false, latencyMs: 4000 });
    const healthy = source({ url: 'healthy', provider: 'healthy' });
    const unhealthy = source({ url: 'unhealthy', provider: 'unhealthy' });
    assert.ok(sourceScore(healthy) > sourceScore(unhealthy));
    assert.deepEqual(
      rankSources([unhealthy, healthy]).map((item) => item.url),
      ['healthy', 'unhealthy'],
    );
  });

  it('does not mutate the input array', () => {
    const input = [source({ url: 'a', container: 'mkv' }), source({ url: 'b' })];
    const copy = [...input];
    rankSources(input);
    assert.deepEqual(input, copy);
  });
});
