'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');

// Even the default (store-backed) route must never open the real database.
process.env.PEAK_DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'peak-epg-routes-')), 'test.db');

const { createLiveRoutes } = require('../routes/liveRoutes');

async function withApp(getEpg, fn) {
  const app = express();
  createLiveRoutes(app, getEpg ? { getEpg } : undefined);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.close();
  }
}

const programme = {
  channel: 'cnn.us',
  start: '2026-10-26T12:00:00.000Z',
  stop: '2026-10-26T13:00:00.000Z',
  title: 'News Hour',
  description: 'Top stories',
  category: 'News',
};

test('GET /api/v1/live/tv/epg/:id returns the success envelope', async () => {
  const calls = [];
  await withApp(async (id, options) => {
    calls.push({ id, options });
    return { now: programme, next: null, schedule: [programme] };
  }, async (base) => {
    const response = await fetch(`${base}/api/v1/live/tv/epg/cnn.us`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.deepEqual(body.epg, { now: programme, next: null, schedule: [programme] });
    assert.equal(calls[0].id, 'cnn.us');
    assert.equal(typeof calls[0].options.now, 'number');
  });
});

test('unknown ids return an empty schedule with 200', async () => {
  await withApp(async () => ({ now: null, next: null, schedule: [] }), async (base) => {
    const response = await fetch(`${base}/api/v1/live/tv/epg/nope.us`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body, { success: true, epg: { now: null, next: null, schedule: [] } });
  });
});

test('lookup failures return 500 INTERNAL_ERROR', async () => {
  await withApp(async () => {
    throw new Error('database is locked');
  }, async (base) => {
    const response = await fetch(`${base}/api/v1/live/tv/epg/cnn.us`);
    assert.equal(response.status, 500);
    const body = await response.json();
    assert.deepEqual(body, { success: false, error: 'INTERNAL_ERROR' });
  });
});

test('the default lookup is store-backed and returns an empty schedule', async () => {
  await withApp(null, async (base) => {
    const response = await fetch(`${base}/api/v1/live/tv/epg/unknown.us`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body, { success: true, epg: { now: null, next: null, schedule: [] } });
  });
});
