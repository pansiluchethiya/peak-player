import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseImageTracks } from '../src/lib/thumbnails';

describe('HLS image tracks', () => {
  it('parses EXT-X-IMAGE-STREAM-INF and EXT-X-TILES', () => {
    const manifest = '#EXTM3U\n#EXT-X-IMAGE-STREAM-INF:BANDWIDTH=1000,RESOLUTION=320x180,CODECS="jpeg",URI="thumbs.jpg"\n#EXT-X-TILES:RESOLUTION=320x180,LAYOUT=10x10,DURATION=10';
    assert.deepEqual(parseImageTracks(manifest, 'https://cdn.example/master.m3u8'), { url: 'https://cdn.example/thumbs.jpg', tileWidth: 320, tileHeight: 180, columns: 10, rows: 10, duration: 10 });
  });
});
