'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveMedia } = require('../utils/mediaResolver');
const { isRealTmdbKey } = require('../utils/tmdb');

const json = (body) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) });

test('TMDB hit wins when a real key exists', async () => {
  const media = await resolveMedia({ type: 'movie', id: '550' }, {
    getTmdbApiKey: () => 'real-key',
    getDetails: async () => ({ title: 'Fight Club', release_date: '1999-10-15', overview: 'A', tagline: 'T', runtime: 139, genres: [{ name: 'Drama' }], vote_average: 8.4, poster_path: '/p.jpg', backdrop_path: '/b.jpg' }),
    fetch: async () => { throw new Error('must not call keyless stages'); },
  });
  assert.equal(media.source, 'tmdb');
  assert.equal(media.title, 'Fight Club');
  assert.equal(media.year, 1999);
  assert.equal(media.poster.candidates[0], 'https://image.tmdb.org/t/p/w780/p.jpg');
});

test('Wikidata finds the article and Wikipedia supplies the poster', async () => {
  const fetch = async (url) => url.includes('query.wikidata.org')
    ? json({ results: { bindings: [{ itemLabel: { value: 'Fight Club' }, article: { value: 'https://en.wikipedia.org/wiki/Fight_Club' } }] } })
    : json({ title: 'Fight Club', description: '1999 American film by David Fincher', extract: 'An insomniac…', originalimage: { source: 'https://upload.wikimedia.org/fight-club.jpg' } });
  const media = await resolveMedia({ type: 'movie', id: '550' }, { getTmdbApiKey: () => null, fetch });
  assert.equal(media.source, 'wikipedia');
  assert.equal(media.year, 1999);
  assert.equal(media.poster.candidates[0], 'https://upload.wikimedia.org/fight-club.jpg');
});

test('TVMaze supplies a TV episode still', async () => {
  const fetch = async (url) => url.includes('lookup/shows')
    ? json({ id: 82, name: 'Game of Thrones', premiered: '2011-04-17', genres: ['Drama'], rating: { average: 9.1 } })
    : json([{ name: 'Winter Is Coming', summary: '<p>Ned Stark…</p>', runtime: 62, image: { original: 'https://static.tvmaze.com/still.jpg' } }]);
  const media = await resolveMedia({ type: 'tv', id: '1399', season: 1, episode: 1 }, { getTmdbApiKey: () => null, fetch });
  assert.equal(media.source, 'tvmaze');
  assert.equal(media.title, 'Game of Thrones');
  assert.equal(media.overview, 'Ned Stark…');
  assert.deepEqual(media.stills, ['https://static.tvmaze.com/still.jpg']);
});

test('total failure returns a generated record and never throws', async () => {
  const media = await resolveMedia({ type: 'movie', id: '999999' }, { getTmdbApiKey: () => null, fetch: async () => { throw new Error('offline'); } });
  assert.equal(media.source, 'generated');
  assert.equal(media.title, 'Untitled');
  assert.deepEqual(media.poster.candidates, []);
});

test('invalid ids are rejected before any network call', async () => {
  let called = false;
  await assert.rejects(
    () => resolveMedia({ type: 'movie', id: '../../etc/passwd' }, { getTmdbApiKey: () => 'real', getDetails: async () => { called = true; }, fetch: async () => { called = true; } }),
    (error) => error.code === 'INVALID_MEDIA_ID',
  );
  assert.equal(called, false);
});

test('a hung TMDB episode lookup keeps the series details', { timeout: 5000 }, async () => {
  const media = await resolveMedia({ type: 'tv', id: '1399', season: 1, episode: 1 }, {
    getTmdbApiKey: () => 'real-key',
    getDetails: async () => ({ name: 'Game of Thrones', first_air_date: '2011-04-17', episode_run_time: [57], poster_path: '/p.jpg', backdrop_path: '/b.jpg', vote_average: 9.1, genres: [{ name: 'Drama' }] }),
    getEpisodeDetails: () => new Promise(() => {}),
    fetch: async () => { throw new Error('must not call keyless stages'); },
  });
  assert.equal(media.source, 'tmdb');
  assert.equal(media.title, 'Game of Thrones');
  assert.equal(media.runtime, 57);
  assert.deepEqual(media.stills, []);
});

test('a never-resolving keyless stage times out and falls through to generated', { timeout: 8000 }, async () => {
  const started = Date.now();
  const media = await resolveMedia({ type: 'movie', id: '999999' }, {
    getTmdbApiKey: () => null,
    fetch: () => new Promise(() => {}),
  });
  const elapsed = Date.now() - started;
  assert.equal(media.source, 'generated');
  assert.equal(media.title, 'Untitled');
  assert.ok(elapsed < 5000, `resolver took ${elapsed}ms`);
});

test('TVMaze ignores non-http artwork URLs', async () => {
  const fetch = async (url) => url.includes('lookup/shows')
    ? json({ id: 82, name: 'Game of Thrones', image: { original: 'javascript:alert(1)' } })
    : json({ name: 'Winter Is Coming', summary: '<p>Ned Stark…</p>', image: { original: '/relative.jpg' } });
  const media = await resolveMedia({ type: 'tv', id: '1399', season: 1, episode: 1 }, { getTmdbApiKey: () => null, fetch });
  assert.equal(media.seriesPoster, null);
  assert.deepEqual(media.stills, []);
});

test('schema:about query strings are stripped from the Wikipedia article', async () => {
  const urls = [];
  const fetch = async (url) => {
    urls.push(url);
    if (url.includes('query.wikidata.org')) {
      return json({ results: { bindings: [{ itemLabel: { value: 'Fight Club' }, article: { value: 'https://en.wikipedia.org/wiki/Fight_Club?oldid=123' } }] } });
    }
    return json({ title: 'Fight Club', description: '1999 American film', extract: 'An insomniac…' });
  };
  const media = await resolveMedia({ type: 'movie', id: '550' }, { getTmdbApiKey: () => null, fetch });
  assert.equal(media.source, 'wikipedia');
  assert.ok(urls.some((url) => url.includes('/page/summary/Fight_Club') && !url.includes('oldid')));
});

test('isRealTmdbKey ignores case and surrounding whitespace', () => {
  assert.equal(isRealTmdbKey('  YOUR_TMDB_API_KEY  '), false);
  assert.equal(isRealTmdbKey(' real-key '), true);
  assert.equal(isRealTmdbKey(''), false);
});
