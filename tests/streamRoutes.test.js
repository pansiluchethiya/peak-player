'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createStreamRoutes } = require('../routes/streamRoutes');

async function withApp(deps, fn) {
  const app = express();
  createStreamRoutes(app, deps);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  try { await fn(`http://127.0.0.1:${server.address().port}`); }
  finally { server.close(); }
}

test('four-segment TV stream route maps season and episode', async () => {
  const calls = [];
  await withApp({
    getPlayerStream: async (args) => { calls.push(args); return { id: args.id, type: args.type, title: 'T', sources: [], subtitles: [], diagnostics: [] }; },
    getPlayerStreamEvents: () => {},
    serverUrl: () => 'http://api.test',
    validSource: () => true,
    config: { marker: true },
  }, async (base) => {
    const res = await fetch(`${base}/api/v1/stream/tv/1399/2/3`);
    assert.equal(res.status, 200);
    assert.deepEqual(calls[0], { type: 'tv', id: '1399', season: 2, episode: 3, source: undefined, serverUrl: 'http://api.test', config: { marker: true } });
  });
});

test('source is forwarded and invalid source is a 400', async () => {
  const calls = [];
  await withApp({
    getPlayerStream: async (args) => { calls.push(args); return { success: true }; },
    getPlayerStreamEvents: () => {},
    serverUrl: () => 'http://api.test',
    validSource: (name) => name === 'vixsrc',
  }, async (base) => {
    assert.equal((await fetch(`${base}/api/v1/stream/movie/550?source=vixsrc`)).status, 200);
    assert.equal(calls[0].source, 'vixsrc');
    const bad = await fetch(`${base}/api/v1/stream/movie/550?source=evil`);
    assert.equal(bad.status, 400);
    assert.equal((await bad.json()).error, 'INVALID_SOURCE');
  });
});

test('four-segment TV events route sends season and episode as query values', async () => {
  const calls = [];
  await withApp({
    getPlayerStream: () => {},
    getPlayerStreamEvents: async (args) => {
      calls.push(args);
      args.onEvent('done', { meta: { providers: 0, sources: 0, subtitles: 0, latencyMs: 0, cacheHit: false }, diagnostics: [] });
    },
    serverUrl: () => 'http://api.test',
    validSource: () => true,
  }, async (base) => {
    const res = await fetch(`${base}/api/v1/stream/events/tv/1399/2/3`);
    assert.equal(res.status, 200);
    assert.equal(calls[0].type, 'tv');
    assert.equal(calls[0].season, 2);
    assert.equal(calls[0].episode, 3);
    assert.equal(calls[0].source, undefined);
  });
});

test('events family rejects an invalid source before writing SSE headers', async () => {
  let called = false;
  await withApp({
    getPlayerStream: () => {},
    getPlayerStreamEvents: () => { called = true; },
    serverUrl: () => 'http://api.test',
    validSource: (name) => name === 'vixsrc',
  }, async (base) => {
    const res = await fetch(`${base}/api/v1/stream/events/movie/550?source=evil`);
    assert.equal(res.status, 400);
    assert.equal(res.headers.get('content-type'), 'application/json; charset=utf-8');
    assert.deepEqual(await res.json(), { success: false, error: 'INVALID_SOURCE' });
    assert.equal(called, false);
  });
});

test('empty source is a supplied source and is rejected on both families', async () => {
  let jsonCalls = 0;
  let eventCalls = 0;
  await withApp({
    getPlayerStream: async () => { jsonCalls += 1; return { success: true, sources: [] }; },
    getPlayerStreamEvents: () => { eventCalls += 1; },
    serverUrl: () => 'http://api.test',
    validSource: (name) => name === 'vixsrc',
  }, async (base) => {
    const json = await fetch(`${base}/api/v1/stream/movie/550?source=`);
    assert.equal(json.status, 400);
    assert.deepEqual(await json.json(), { success: false, error: 'INVALID_SOURCE' });

    const events = await fetch(`${base}/api/v1/stream/events/movie/550?source=`);
    assert.equal(events.status, 400);
    assert.equal(events.headers.get('content-type'), 'application/json; charset=utf-8');
    assert.deepEqual(await events.json(), { success: false, error: 'INVALID_SOURCE' });

    assert.equal(jsonCalls, 0);
    assert.equal(eventCalls, 0);
  });
});

test('movies receive null season and episode and invalid values are not coerced', async () => {
  const calls = [];
  await withApp({
    getPlayerStream: async (args) => { calls.push(args); return { success: true, sources: [] }; },
    getPlayerStreamEvents: () => {},
    serverUrl: () => 'http://api.test',
    validSource: () => true,
  }, async (base) => {
    assert.equal((await fetch(`${base}/api/v1/stream/movie/550`)).status, 200);
    assert.equal(calls[0].season, null);
    assert.equal(calls[0].episode, null);

    assert.equal((await fetch(`${base}/api/v1/stream/tv/1399?season=0&episode=abc`)).status, 200);
    assert.equal(calls[1].season, null);
    assert.equal(calls[1].episode, null);
  });
});
