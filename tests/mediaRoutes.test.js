'use strict';
const { beforeEach, test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createMediaRoutes } = require('../routes/mediaRoutes');
const { clearMediaCache, getMedia } = require('../utils/mediaResolver');

async function withApp(getMedia, fn) {
  const app = express();
  createMediaRoutes(app, { getMedia });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  try { await fn(`http://127.0.0.1:${server.address().port}`); } finally { server.close(); }
}

function record(overrides = {}) {
  return {
    id: '550',
    type: 'movie',
    title: 'Fight Club',
    year: 1999,
    overview: null,
    tagline: null,
    runtime: null,
    genres: [],
    rating: null,
    poster: { candidates: [] },
    backdrop: null,
    stills: [],
    seriesPoster: null,
    source: 'wikipedia',
    ...overrides,
  };
}

beforeEach(() => {
  clearMediaCache();
});

test('movie returns the success envelope', async () => {
  await withApp(async ({ type, id }) => ({ media: { id, type, title: 'Fight Club', source: 'wikipedia' }, cacheHit: false }), async (base) => {
    const body = await (await fetch(`${base}/api/v1/media/movie/550`)).json();
    assert.equal(body.success, true);
    assert.equal(body.media.title, 'Fight Club');
  });
});

test('invalid types are 400 and unknown ids still return a generated record', async () => {
  await withApp(async () => ({ media: { title: 'Untitled', source: 'generated' }, cacheHit: false }), async (base) => {
    assert.equal((await fetch(`${base}/api/v1/media/book/550`)).status, 400);
    const unknown = await (await fetch(`${base}/api/v1/media/movie/999999`)).json();
    assert.equal(unknown.media.source, 'generated');
  });
});

test('season and episode are forwarded to the resolver as numbers', async () => {
  const calls = [];
  await withApp(async (input) => {
    calls.push(input);
    return { media: record({ type: 'tv', id: input.id, title: 'Game of Thrones', source: 'tvmaze' }), cacheHit: false };
  }, async (base) => {
    const res = await fetch(`${base}/api/v1/media/tv/1399?season=2&episode=3`);
    assert.equal(res.status, 200);
    assert.deepEqual(calls[0], { type: 'tv', id: '1399', season: 2, episode: 3 });
  });
});

test('non-numeric ids are 400 before the resolver runs', async () => {
  let called = false;
  await withApp(async () => {
    called = true;
    return { media: record(), cacheHit: false };
  }, async (base) => {
    const res = await fetch(`${base}/api/v1/media/movie/not-an-id`);
    assert.equal(res.status, 400);
    assert.equal((await res.json()).success, false);
  });
  assert.equal(called, false);
});

test('resolver errors are surfaced without throwing', async () => {
  await withApp(async () => {
    const error = new Error('boom');
    error.code = 'MEDIA_UNAVAILABLE';
    throw error;
  }, async (base) => {
    const res = await fetch(`${base}/api/v1/media/movie/550`);
    assert.equal(res.status, 500);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error, 'MEDIA_UNAVAILABLE');
  });
});

test('getMedia caches positive records for six hours and returns clones', async () => {
  let clock = 0;
  let calls = 0;
  const deps = {
    now: () => clock,
    resolveMedia: async () => {
      calls += 1;
      return record({ poster: { candidates: ['https://image.example/poster.jpg'] } });
    },
  };

  const first = await getMedia({ type: 'movie', id: '550' }, deps);
  assert.equal(first.cacheHit, false);
  assert.equal(first.media.title, 'Fight Club');

  const second = await getMedia({ type: 'movie', id: '550' }, deps);
  assert.equal(second.cacheHit, true);
  assert.equal(calls, 1);

  second.media.poster.candidates.push('https://image.example/mutated.jpg');
  const third = await getMedia({ type: 'movie', id: '550' }, deps);
  assert.deepEqual(third.media.poster.candidates, ['https://image.example/poster.jpg']);

  clock = 6 * 60 * 60 * 1000 - 1;
  assert.equal((await getMedia({ type: 'movie', id: '550' }, deps)).cacheHit, true);
  assert.equal(calls, 1);

  clock = 6 * 60 * 60 * 1000;
  assert.equal((await getMedia({ type: 'movie', id: '550' }, deps)).cacheHit, false);
  assert.equal(calls, 2);
});

test('getMedia caches generated records for fifteen minutes', async () => {
  let clock = 0;
  let calls = 0;
  const deps = {
    now: () => clock,
    resolveMedia: async () => {
      calls += 1;
      return record({ title: 'Untitled', source: 'generated' });
    },
  };

  assert.equal((await getMedia({ type: 'movie', id: '999999' }, deps)).cacheHit, false);
  clock = 15 * 60 * 1000 - 1;
  assert.equal((await getMedia({ type: 'movie', id: '999999' }, deps)).cacheHit, true);
  assert.equal(calls, 1);

  clock = 15 * 60 * 1000;
  assert.equal((await getMedia({ type: 'movie', id: '999999' }, deps)).cacheHit, false);
  assert.equal(calls, 2);
});

test('getMedia keys TV cache entries by season and episode', async () => {
  const calls = [];
  const deps = {
    now: () => 0,
    resolveMedia: async (input) => {
      calls.push(input);
      return record({ type: 'tv', id: input.id, title: `S${input.season}E${input.episode}`, source: 'tvmaze' });
    },
  };

  await getMedia({ type: 'tv', id: '1399', season: 1, episode: 1 }, deps);
  await getMedia({ type: 'tv', id: '1399', season: 1, episode: 2 }, deps);
  await getMedia({ type: 'tv', id: '1399', season: 1, episode: 1 }, deps);

  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map((input) => [input.season, input.episode]), [[1, 1], [1, 2]]);
});
