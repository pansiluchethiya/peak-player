import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { engineSource } from '../src/components/player/media/source';
import { PeakPlayerError, toPlayerError } from '../src/components/player/errors';

const base = { quality: 'auto', provider: 'p', expiresIn: 900, browserPlayable: true };
const movie = { type: 'movie' as const, id: '550' };
const live = { type: 'live_tv' as const, id: '7' };

describe('engine source mapping', () => {
  it('routes adaptive sources to HLS', () => {
    assert.deepEqual(
      engineSource({ ...base, url: 'https://x/a.m3u8', codec: 'hls', adaptive: true }, movie),
      { kind: 'hls', src: 'https://x/a.m3u8', type: 'application/vnd.apple.mpegurl', streamType: 'on-demand' },
    );
  });
  it('routes progressive files to the native video element', () => {
    assert.equal(engineSource({ ...base, url: 'https://x/a.mp4', codec: 'mp4' }, movie).kind, 'native');
  });
  it('routes external pages to the embed surface', () => {
    assert.equal(engineSource({ ...base, url: 'https://x/e', codec: 'html5' }, movie).kind, 'external');
  });
  it('routes non-browser-playable files to the embed surface even when progressive', () => {
    assert.equal(
      engineSource({ ...base, browserPlayable: false, url: 'https://x/a.mp4', codec: 'mp4' }, movie).kind,
      'external',
    );
  });
  it('honours an explicit HLS container on a URL without an m3u8 suffix', () => {
    assert.deepEqual(engineSource({ ...base, url: 'https://x/play', codec: 'mp4', container: 'hls' }, movie), {
      kind: 'hls',
      src: 'https://x/play',
      type: 'application/vnd.apple.mpegurl',
      streamType: 'on-demand',
    });
  });
  it('detects m3u8 paths with query strings and fragments', () => {
    for (const url of ['https://x/a.m3u8?token=x', 'https://x/a.m3u8#t=10']) {
      assert.deepEqual(engineSource({ ...base, url, codec: 'hls' }, movie), {
        kind: 'hls',
        src: url,
        type: 'application/vnd.apple.mpegurl',
        streamType: 'on-demand',
      });
    }
  });
  it('routes webm files to the native video element', () => {
    assert.equal(engineSource({ ...base, url: 'https://x/a.webm', codec: 'webm' }, movie).kind, 'native');
  });
  it('marks live TV sources as live streams', () => {
    assert.equal(engineSource({ ...base, url: 'https://x/a.m3u8', codec: 'hls' }, live).streamType, 'live');
  });
});

describe('player errors', () => {
  it('keeps typed codes and maps unknown failures', () => {
    assert.equal(new PeakPlayerError('NOT_READY', 'x').code, 'NOT_READY');
    assert.equal(toPlayerError(new Error('x')).code, 'UNKNOWN');
  });
  it('preserves an existing PeakPlayerError instance', () => {
    const original = new PeakPlayerError('TOKEN_EXPIRED', 'expired');
    assert.equal(toPlayerError(original), original);
  });
  it('propagates an Error message', () => {
    assert.equal(toPlayerError(new Error('boom')).message, 'boom');
  });
  it('stringifies non-Error values', () => {
    assert.equal(toPlayerError('nope').message, 'nope');
  });
});
