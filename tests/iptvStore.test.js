'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.PEAK_DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'peak-iptv-')), 'test.db');
const store = require('../utils/iptvStore');

test('re-seeding preserves enabled state and health history', () => {
  store.ensureIptvTables();
  const playlist = store.ensureSeedPlaylist();
  store.upsertChannels(playlist.id, [{ id: 'c1', name: 'A', url: 'https://a/1.m3u8', groupTitle: 'News' }]);
  store.setChannelEnabled('c1', false);
  store.setChannelHealth('c1', { status: 'ok', httpStatus: 206, latencyMs: 12, checkedAt: '2026-01-01T00:00:00.000Z', failCount: 0, nextCheckAt: null });
  store.upsertChannels(playlist.id, [{ id: 'c1', name: 'A2', url: 'https://a/2.m3u8', groupTitle: 'News' }]);
  const channel = store.getChannel('c1');
  assert.equal(channel.name, 'A2');
  assert.equal(channel.enabled, 0);
  assert.equal(channel.status, 'ok');
  assert.equal(store.listChannels({}).channels.length, 1);
  assert.equal(store.listChannels({ status: 'ok' }).channels[0].id, 'c1');
  assert.equal(store.listChannels({ status: 'dead' }).channels.length, 0);
});

test('listDueChannels returns enabled channels whose next check is due', () => {
  store.ensureIptvTables();
  const playlist = store.ensureSeedPlaylist();
  store.upsertChannels(playlist.id, [
    { id: 'due', name: 'Due', url: 'https://d/1.m3u8' },
    { id: 'future', name: 'Future', url: 'https://f/1.m3u8' },
    { id: 'off', name: 'Off', url: 'https://o/1.m3u8' },
  ]);
  store.setChannelHealth('due', { status: 'unknown' });
  store.setChannelHealth('future', {
    status: 'ok',
    checkedAt: '2026-01-01T00:00:00.000Z',
    nextCheckAt: '2026-01-02T00:00:00.000Z',
  });
  store.setChannelHealth('off', { status: 'unknown' });
  store.setChannelEnabled('off', false);

  const due = store.listDueChannels({ now: Date.parse('2026-01-01T12:00:00Z') });
  assert.deepEqual(due.map((channel) => channel.id), ['due']);
});
