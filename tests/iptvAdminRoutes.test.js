'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createIptvAdminRoutes } = require('../routes/iptvAdminRoutes');

test('admin IPTV routes require a session', async () => {
  const app = express();
  createIptvAdminRoutes(app, { store: { listPlaylists: () => [] }, requireAuth: (req, res) => res.status(401).json({ success: false }) });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/iptv/playlists`);
    assert.equal(res.status, 401);
  } finally { server.close(); }
});

test('admin channel list returns rows with health', async () => {
  const app = express();
  const store = {
    listPlaylists: () => [{ id: 1, name: 'seed:iptv-org', url: 'seed:iptv-org', enabled: true, channelCount: 3, lastSyncAt: '2026-01-01T00:00:00Z', lastError: null, seeded: true, guideUrl: null, guide_url: null }],
    listChannelsFlat: () => [{ id: 1, name: 'CNN', groupTitle: 'News', group: 'News', enabled: 1, status: 'ok', httpStatus: 200, latencyMs: 321, checkedAt: '2026-01-01T00:00:00Z', failCount: 0, nextCheckAt: null }],
    listGroups: () => ['News'],
  };
  createIptvAdminRoutes(app, { store, requireAuth: (req, res, next) => next() });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/iptv/channels`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.channels[0].name, 'CNN');
    assert.equal(body.channels[0].status, 'ok');
  } finally { server.close(); }
});

test('seed PATCH writes config', async () => {
  const app = express();
  app.use(express.json());
  let written = null;
  createIptvAdminRoutes(app, {
    store: { listPlaylists: () => [], listChannelsFlat: () => [], listGroups: () => [] },
    requireAuth: (req, res, next) => next(),
    config: { iptvSeedEnabled: true, iptvSeedCategories: '*', iptvSeedCountries: '*' },
    saveConfigPatch: (patch) => { written = patch; },
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/iptv/seed`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: false }),
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(written.iptvSeedEnabled, false);
    assert.equal(body.success, true);
  } finally { server.close(); }
});
