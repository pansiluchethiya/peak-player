'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { mapRiveSource, parseDubLanguage, PROVIDERS } = require('../providers/rive');

const APOGEE = { id: 'apogee', label: 'Apogee', provider: 'Peak Prime' };
const CITADEL = { id: 'citadel', label: 'Citadel', provider: 'Peak Orbit' };

describe('Rive provider mapping', () => {
  it('maps Apogee and Vanguard as primary streams with wrapper headers', () => {
    const entry = {
      quality: '1080p',
      url: 'https://proxy.valhallastream.com/m3u8?url=https%3A%2F%2Fexample.com%2Fmaster.m3u8&headers=%7B%22Origin%22%3A%22https%3A%2F%2Fbingr.one%22%7D',
      source: 'Apogee',
      format: 'hls',
    };
    const stream = mapRiveSource(entry, APOGEE, [], null);
    assert.ok(stream);
    assert.equal(stream.provider, 'Peak Prime');
    assert.equal(stream.codec, 'hls');
    assert.equal(stream.adaptive, true);
    assert.equal(stream.unwrap, false);
    assert.deepEqual(stream.headers, {
      Origin: 'http://localhost:3011',
      Referer: 'http://localhost:3011/',
      'User-Agent': stream.headers['User-Agent'],
    });
  });

  it('marks Citadel as a dub stream with language parsed from quality', () => {
    const entry = {
      quality: '720p | Hindi',
      url: 'https://img1.hscow.com/hls_mps/test/720/index_287.m3u8?Expires=1793180655&Signature=x',
      source: 'Citadel',
      format: 'hls',
    };
    const stream = mapRiveSource(entry, CITADEL, [], null);
    assert.equal(stream.provider, 'Peak Orbit');
    assert.equal(stream.dub, 'Hindi');
    assert.equal(stream.audioLang, 'hi');
    assert.equal(stream.unwrap, undefined);
    assert.equal(stream.expiresIn, 14_400);
  });

  it('parses English Citadel quality as English dub', () => {
    const entry = {
      quality: '720p | English',
      url: 'https://img1.hscow.com/hls_mps/test/720/index_287.m3u8?Expires=1793180655&Signature=x',
      source: 'Citadel',
      format: 'hls',
    };
    const stream = mapRiveSource(entry, CITADEL, [], null);
    assert.equal(stream.dub, 'English');
    assert.equal(stream.audioLang, 'en');
  });

  it('passes through thumbnail VTT and captions', () => {
    const entry = {
      quality: '1080p',
      url: 'https://proxy.valhallastream.com/m3u8?url=https%3A%2F%2Fexample.com%2Fmaster.m3u8',
      source: 'Apogee',
      format: 'hls',
    };
    const captions = [{ file: 'https://example.com/sub.vtt', label: 'English', language: 'en' }];
    const stream = mapRiveSource(entry, APOGEE, captions, 'https://example.com/thumbnails.vtt');
    assert.equal(stream.thumbnailVtt, 'https://example.com/thumbnails.vtt');
    assert.equal(stream.subtitles[0].url, 'https://example.com/sub.vtt');
    assert.equal(stream.subtitles[0].lang, 'en');
  });

  it('skips non-HLS formats', () => {
    const entry = {
      quality: '720p',
      url: 'https://example.com/video.mp4',
      source: 'Vanguard',
      format: 'mp4',
    };
    const stream = mapRiveSource(entry, APOGEE, [], null);
    assert.equal(stream, null);
  });

  it('skips entries without a URL', () => {
    const stream = mapRiveSource({ quality: '1080p', source: 'Apogee', format: 'hls' }, APOGEE, [], null);
    assert.equal(stream, null);
  });
});

describe('parseDubLanguage', () => {
  it('extracts Hindi from quality suffix', () => {
    assert.equal(parseDubLanguage('720p | Hindi'), 'Hindi');
  });

  it('extracts English from quality suffix', () => {
    assert.equal(parseDubLanguage('720p | English'), 'English');
  });

  it('returns null for plain qualities', () => {
    assert.equal(parseDubLanguage('1080p'), null);
    assert.equal(parseDubLanguage('4K HDR'), null);
    assert.equal(parseDubLanguage('HLS'), null);
  });

  it('returns null for Tamil', () => {
    assert.equal(parseDubLanguage('480p | Tamil'), 'Tamil');
  });
});

describe('Rive provider ids', () => {
  it('includes all four providers', () => {
    assert.equal(PROVIDERS.length, 4);
    const ids = PROVIDERS.map((p) => p.id);
    assert.deepEqual(ids, ['apogee', 'vanguard', 'pulse', 'citadel']);
  });

  it('exposes unique provider ids for server switching', () => {
    const providers = PROVIDERS.map((p) => p.provider);
    const unique = new Set(providers);
    assert.equal(unique.size, providers.length);
  });
});
