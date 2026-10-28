import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseImageTracks, parseThumbnailVtt, thumbnailCueAt } from '../src/lib/thumbnails';

describe('HLS image tracks', () => {
  it('parses EXT-X-IMAGE-STREAM-INF and EXT-X-TILES', () => {
    const manifest = '#EXTM3U\n#EXT-X-IMAGE-STREAM-INF:BANDWIDTH=1000,RESOLUTION=320x180,CODECS="jpeg",URI="thumbs.jpg"\n#EXT-X-TILES:RESOLUTION=320x180,LAYOUT=10x10,DURATION=10';
    assert.deepEqual(parseImageTracks(manifest, 'https://cdn.example/master.m3u8'), { url: 'https://cdn.example/thumbs.jpg', tileWidth: 320, tileHeight: 180, columns: 10, rows: 10, duration: 10 });
  });
});

describe('parseThumbnailVtt', () => {
  it('parses vidsrc-style sprite cues', () => {
    const vtt = `WEBVTT

00:00:00 --> 00:00:30
/static/i0hk/1/1bhy0/224bf45881252643dfc2e71abc7b2660a21c68c4/12snnbc/img1.jpg#xywh=0,0,160,67

00:00:30 --> 00:01:00
/static/i0hk/1/1bhy0/224bf45881252643dfc2e71abc7b2660a21c68c4/12snnbc/img1.jpg#xywh=160,0,160,67

00:01:00 --> 00:01:30
/static/i0hk/1/1bhy0/224bf45881252643dfc2e71abc7b2660a21c68c4/12snnbc/img1.jpg#xywh=320,0,160,67
`;
    const base = 'https://vidapi.cloud/static/i0hk/1/1bhy0/224bf45881252643dfc2e71abc7b2660a21c68c4/12snnbc/thumbnails.vtt';
    const result = parseThumbnailVtt(vtt, base);
    assert.ok(result);
    assert.equal(result.cues.length, 3);
    assert.equal(result.spriteWidth, 480); // 320 + 160
    assert.equal(result.spriteHeight, 67);
    assert.equal(result.cues[0].url, 'https://vidapi.cloud/static/i0hk/1/1bhy0/224bf45881252643dfc2e71abc7b2660a21c68c4/12snnbc/img1.jpg');
    assert.equal(result.cues[0].x, 0);
    assert.equal(result.cues[0].y, 0);
    assert.equal(result.cues[0].width, 160);
    assert.equal(result.cues[0].height, 67);
  });

  it('resolves relative sprite URLs against the VTT base', () => {
    const vtt = `WEBVTT

00:00:00 --> 00:00:30
img1.jpg#xywh=0,0,160,67
`;
    const result = parseThumbnailVtt(vtt, 'https://cdn.example.com/thumbnails.vtt');
    assert.ok(result);
    assert.equal(result.cues[0].url, 'https://cdn.example.com/img1.jpg');
  });

  it('returns null for non-VTT input', () => {
    assert.equal(parseThumbnailVtt('not a vtt', 'https://cdn.example.com/'), null);
    assert.equal(parseThumbnailVtt('', 'https://cdn.example.com/'), null);
  });

  it('returns null when no valid cues', () => {
    assert.equal(parseThumbnailVtt('WEBVTT\n\n00:00:00 --> 00:00:30\n', 'https://cdn.example.com/'), null);
  });
});

describe('thumbnailCueAt', () => {
  const vtt = parseThumbnailVtt(`WEBVTT

00:00:00 --> 00:00:30
img.jpg#xywh=0,0,160,67

00:00:30 --> 00:01:00
img.jpg#xywh=160,0,160,67

00:01:00 --> 00:01:30
img.jpg#xywh=320,0,160,67
`, 'https://cdn.example.com/');

  it('finds the cue covering a time', () => {
    const cue = thumbnailCueAt(vtt, 15);
    assert.ok(cue);
    assert.equal(cue.x, 0);
    assert.equal(cue.y, 0);
  });

  it('finds the cue for the second interval', () => {
    const cue = thumbnailCueAt(vtt, 45);
    assert.ok(cue);
    assert.equal(cue.x, 160);
  });

  it('returns null outside all cues', () => {
    assert.equal(thumbnailCueAt(vtt, 999), null);
  });

  it('returns null for empty vtt', () => {
    assert.equal(thumbnailCueAt(null, 15), null);
  });
});
