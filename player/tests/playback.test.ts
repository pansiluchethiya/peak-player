import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isPlayableSource, nextSourceIndex, sourceKey } from '../src/lib/playback';
import type { Source } from '../src/lib/types';

function source(overrides: Partial<Source> = {}): Source {
  return {
    url: 'https://cdn.example/1080.m3u8',
    quality: '1080p',
    codec: 'hls',
    provider: 'alpha',
    adaptive: true,
    expiresIn: 900,
    ...overrides,
  };
}

describe('playback source selection', () => {
  it('rejects MKV sources that the browser cannot play', () => {
    assert.equal(isPlayableSource(source()), true);
    assert.equal(isPlayableSource(source({ codec: 'mkv', container: 'mkv' })), false);
    assert.equal(isPlayableSource(source({ browserPlayable: false })), false);
    assert.equal(isPlayableSource(undefined), false);
  });

  it('tries every source once and wraps around', () => {
    const sources = [source({ url: 'a' }), source({ url: 'b' }), source({ url: 'c' })];
    const attempted = new Set([sourceKey(sources[0], 0)]);

    assert.equal(nextSourceIndex(sources, 0, attempted), 1);
    attempted.add(sourceKey(sources[1], 1));
    assert.equal(nextSourceIndex(sources, 1, attempted), 2);
    attempted.add(sourceKey(sources[2], 2));
    assert.equal(nextSourceIndex(sources, 2, attempted), -1);
  });

  it('skips unplayable candidates instead of wasting a failover', () => {
    const sources = [
      source({ url: 'hls' }),
      source({ url: 'mkv', codec: 'mkv', container: 'mkv', browserPlayable: false }),
      source({ url: 'mp4', codec: 'mp4', container: 'mp4', adaptive: false }),
    ];
    assert.equal(nextSourceIndex(sources, 0, new Set()), 2);
  });

  it('handles the two-source case without giving up early', () => {
    const sources = [source({ url: 'first' }), source({ url: 'second' })];
    const attempted = new Set([sourceKey(sources[0], 0)]);
    assert.equal(nextSourceIndex(sources, 0, attempted), 1);
  });
});
