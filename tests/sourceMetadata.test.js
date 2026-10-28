'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const {
  buildPlayerSource,
  detectAudioCodec,
  detectContainer,
  detectHdr,
  detectVideoCodec,
} = require('../utils/sourceMetadata');

describe('source metadata', () => {
  it('detects HLS from adaptive sources and m3u8 URLs', () => {
    assert.equal(detectContainer({ url: 'https://cdn.example/master.m3u8' }), 'hls');
    assert.equal(detectContainer({ url: 'https://cdn.example/file', adaptive: true }), 'hls');
  });

  it('detects the real container through a Peak proxy URL', () => {
    const proxied = `https://peak.example/ts-proxy?url=${encodeURIComponent('https://cdn.example/movie.mkv')}`;
    assert.equal(detectContainer({ url: proxied }), 'mkv');
  });

  it('treats a playlist proxy URL as HLS even when the upstream path has no extension', () => {
    const proxied = `https://peak.example/m3u8-proxy?url=${encodeURIComponent(
      'https://cdn.example/playlist/123?type=video',
    )}`;
    const source = buildPlayerSource({ url: proxied, provider: 'vixsrc' });
    assert.equal(source.container, 'hls');
    assert.equal(source.adaptive, true);
    assert.equal(source.browserPlayable, true);
    assert.equal(source.codec, 'hls');
  });

  it('never labels MKV or HEVC as MP4', () => {
    const source = buildPlayerSource({
      url: 'https://cdn.example/movie.mkv',
      quality: '2160p',
      provider: 'dahmermovies',
      codecs: ['HEVC', 'HDR10'],
    });
    assert.equal(source.container, 'mkv');
    assert.equal(source.codec, 'mkv');
    assert.equal(source.videoCodec, 'hevc');
    assert.equal(source.hdr, true);
    assert.equal(source.browserPlayable, false);
  });

  it('preserves MP4 H.264 metadata', () => {
    const source = buildPlayerSource({
      url: 'https://cdn.example/movie.mp4',
      quality: '1080p',
      codecs: ['H.264', 'AAC'],
    });
    assert.equal(source.container, 'mp4');
    assert.equal(source.codec, 'mp4');
    assert.equal(source.videoCodec, 'h264');
    assert.equal(source.audioCodec, 'aac');
    assert.equal(source.hdr, false);
    assert.equal(source.browserPlayable, true);
    assert.equal(source.expiresIn, 900);
  });

  it('detects codec and audio aliases', () => {
    assert.equal(detectVideoCodec({ codecs: ['x265'] }), 'hevc');
    assert.equal(detectVideoCodec({ codecs: ['AVC1'] }), 'h264');
    assert.equal(detectAudioCodec({ codecs: ['E-AC-3'] }), 'eac3');
    assert.equal(detectAudioCodec({ audioCodec: 'Dolby Atmos' }), 'atmos');
  });

  it('detects HDR markers without false positives', () => {
    assert.equal(detectHdr({ codecs: ['HDR10+'] }), true);
    assert.equal(detectHdr({ videoCodec: 'hevc', hdrFormat: 'Dolby Vision' }), true);
    assert.equal(detectHdr({ quality: '1080p', codecs: ['H.264'] }), false);
  });
});

describe('originalUrl unwrap behaviour', () => {
  const { originalUrl } = require('../utils/sourceMetadata');

  it('unwraps a nested url query param by default', () => {
    const stream = { url: 'https://peak.example/m3u8-proxy?url=https%3A%2F%2Fcdn.example%2Fmaster.m3u8' };
    assert.equal(originalUrl(stream), 'https://cdn.example/master.m3u8');
  });

  it('does not unwrap valhallastream wrapper URLs', () => {
    const stream = {
      url: 'https://proxy.valhallastream.com/m3u8?url=https%3A%2F%2Fcdn.example%2Fmaster.m3u8&headers=%7B%7D',
    };
    assert.equal(originalUrl(stream), stream.url);
  });

  it('honours stream.unwrap === false without unwrapping', () => {
    const stream = {
      url: 'https://proxy.valhallastream.com/m3u8?url=https%3A%2F%2Fcdn.example%2Fmaster.m3u8',
      unwrap: false,
    };
    assert.equal(originalUrl(stream), stream.url);
  });

  it('passes through plain HLS URLs', () => {
    const stream = { url: 'https://cdn.example/master.m3u8' };
    assert.equal(originalUrl(stream), 'https://cdn.example/master.m3u8');
  });
});
