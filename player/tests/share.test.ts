import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildShareLink, encodeEmbedParams } from '../src/lib/share';

describe('share', () => {
  it('builds an embed link with provider source', () => {
    const link = buildShareLink({
      origin: 'https://peak.test',
      type: 'movie',
      id: '550',
      source: 'netmirror',
      autoPlay: true,
    });
    assert.equal(link, encodeURI('https://peak.test/embed/movie/550?autoPlay=true&source=netmirror'));
  });

  it('builds a tv link with season and episode', () => {
    const link = buildShareLink({ origin: 'https://peak.test', type: 'tv', id: '1399', season: 1, episode: 1 });
    assert.match(link, /\/embed\/tv\/1399\/1\/1/);
  });

  it('encodes params without a provider', () => {
    const link = buildShareLink({ origin: 'https://peak.test', type: 'movie', id: '550' });
    assert.equal(link, 'https://peak.test/embed/movie/550');
  });

  it('encodeEmbedParams serialises booleans and numbers', () => {
    assert.equal(encodeEmbedParams({ autoPlay: true, source: 'netmirror', v: 2 }), 'autoPlay=true&source=netmirror&v=2');
  });
});
