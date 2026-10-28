'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Never touch the real catalogue database: the syncPlaylist test below exercises
// the store, so point it at a throwaway file before anything requires utils/db.
process.env.PEAK_DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'peak-iptv-sync-')), 'test.db');

const { runIptvCycle, syncPlaylist, SYNC_INTERVAL_MS_DEFAULT } = require('../utils/iptvSync');
const store = require('../utils/iptvStore');
const { encodeChannelId } = require('../utils/iptvId');

test('one failing playlist never blocks the rest and the interval is three hours', async () => {
  const calls = [];
  const result = await runIptvCycle({ now: 1000, deps: {
    seedIptv: async () => { calls.push('seed'); },
    listPlaylists: () => [{ id: 1 }, { id: 2 }, { id: 3 }],
    syncPlaylist: async (id) => { if (id === 2) throw new Error('bad playlist'); calls.push(`sync:${id}`); },
    validateDueChannels: async () => { calls.push('validate'); },
    refreshGuides: async () => { calls.push('guides'); },
  } });
  assert.deepEqual(calls, ['seed', 'sync:1', 'sync:3', 'validate', 'guides']);
  assert.equal(result.failed.length, 1);
  assert.equal(SYNC_INTERVAL_MS_DEFAULT, 10800000);
});

test('seeded and disabled playlists are skipped; validate and guides receive now', async () => {
  const calls = [];
  const now = 1234;
  const result = await runIptvCycle({ now, deps: {
    seedIptv: async () => { calls.push('seed'); },
    listPlaylists: () => [
      { id: 1, enabled: true },
      { id: 2, enabled: false },
      { id: 3, enabled: true, seeded: true, url: 'seed:iptv-org' },
      { id: 4, enabled: true, url: 'seed:iptv-org' },
    ],
    syncPlaylist: async (id) => { calls.push(`sync:${id}`); },
    validateDueChannels: async (options) => {
      calls.push('validate');
      return { checked: 7, now: options.now };
    },
    refreshGuides: async (options) => {
      calls.push('guides');
      return { guides: [], failed: [], now: options.now };
    },
  } });
  assert.deepEqual(calls, ['seed', 'sync:1', 'validate', 'guides']);
  assert.deepEqual(result.failed, []);
  assert.equal(result.validated.checked, 7);
  assert.equal(result.validated.now, now);
  assert.equal(result.guides.now, now);
});

test('a playlist that reports an error is collected without stopping the cycle', async () => {
  const result = await runIptvCycle({ now: 1, deps: {
    seedIptv: async () => {},
    listPlaylists: () => [{ id: 1 }, { id: 2 }],
    syncPlaylist: async (id) => (id === 1
      ? { channelCount: 0, error: 'fetch failed' }
      : { channelCount: 4, error: null }),
    validateDueChannels: async () => ({ checked: 0 }),
    refreshGuides: async () => ({ guides: [], failed: [] }),
  } });
  assert.deepEqual(result.failed, [{ id: 1, error: 'fetch failed' }]);
  assert.deepEqual(result.playlists, [{ id: 2, channelCount: 4 }]);
});

test('seed is skipped when IPTV_SEED_ENABLED is false', async () => {
  const previous = process.env.IPTV_SEED_ENABLED;
  process.env.IPTV_SEED_ENABLED = 'false';
  try {
    const calls = [];
    const result = await runIptvCycle({ now: 1, deps: {
      seedIptv: async () => { calls.push('seed'); },
      listPlaylists: () => [],
      syncPlaylist: async () => { calls.push('sync'); },
      validateDueChannels: async () => { calls.push('validate'); return { checked: 0 }; },
      refreshGuides: async () => { calls.push('guides'); return { guides: [], failed: [] }; },
    } });
    assert.deepEqual(calls, ['validate', 'guides']);
    assert.deepEqual(result.failed, []);
  } finally {
    if (previous === undefined) delete process.env.IPTV_SEED_ENABLED;
    else process.env.IPTV_SEED_ENABLED = previous;
  }
});

test('syncPlaylist upserts channels and preserves operator state and health', async () => {
  store.ensureIptvTables();
  const playlist = store.addPlaylist('Custom', 'https://example.test/list.m3u');
  const channelUrl = 'https://example.test/one.m3u8';
  const channelId = encodeChannelId('One', channelUrl);
  store.upsertChannels(playlist.id, [{ id: channelId, name: 'One', url: channelUrl, groupTitle: 'News' }]);
  store.setChannelEnabled(channelId, false);
  store.setChannelHealth(channelId, {
    status: 'ok',
    httpStatus: 206,
    latencyMs: 12,
    checkedAt: '2026-01-01T00:00:00.000Z',
    failCount: 0,
    nextCheckAt: null,
  });

  const result = await syncPlaylist(playlist.id, {
    readText: async () => ({
      text: `#EXTM3U\n#EXTINF:-1 tvg-id="one" group-title="News",One\n${channelUrl}\n`,
    }),
  });

  assert.equal(result.error, null);
  assert.equal(result.channelCount, 1);
  const channel = store.getChannel(channelId);
  assert.equal(channel.enabled, 0);
  assert.equal(channel.status, 'ok');
  assert.equal(channel.httpStatus, 206);
  assert.equal(channel.latencyMs, 12);
  assert.equal(channel.checkedAt, '2026-01-01T00:00:00.000Z');
});
