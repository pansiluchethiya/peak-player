import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fetchMedia, mediaPath } from '../src/lib/media';
import type { MediaMetadata } from '../src/lib/types';

describe('media client', () => {
  it('builds a TV episode query', () => {
    assert.equal(mediaPath({ type: 'tv', id: '1399', season: 2, episode: 3 }), '/api/v1/media/tv/1399?season=2&episode=3');
  });

  it('defaults a TV episode to season 1 episode 1', () => {
    assert.equal(mediaPath({ type: 'tv', id: '1399' }), '/api/v1/media/tv/1399?season=1&episode=1');
  });

  it('builds a movie path without query parameters', () => {
    assert.equal(mediaPath({ type: 'movie', id: '550' }), '/api/v1/media/movie/550');
  });

  it('unwraps the success envelope', async () => {
    const originalFetch = globalThis.fetch;
    const media: MediaMetadata = {
      id: '550',
      type: 'movie',
      title: 'Fight Club',
      year: 1999,
      overview: null,
      tagline: null,
      runtime: 139,
      genres: ['Drama'],
      rating: 8.4,
      poster: { candidates: [] },
      backdrop: null,
      stills: [],
      seriesPoster: null,
      source: 'wikipedia',
    };
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ success: true, media }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })) as typeof fetch;
    try {
      const result = await fetchMedia('http://api.test/', { type: 'movie', id: '550' });
      assert.equal(result.title, 'Fight Club');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('rejects a failed request', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ success: false, error: 'INVALID_ID' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      })) as typeof fetch;
    try {
      await assert.rejects(
        fetchMedia('http://api.test', { type: 'movie', id: 'bad' }),
        /Media request failed/,
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
