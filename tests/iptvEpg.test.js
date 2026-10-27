'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// The store-backed cases below must never touch the real utils/peak.db.
process.env.PEAK_DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'peak-epg-')), 'test.db');

const { parseXmltv, getEpg, ingestGuide, refreshGuides } = require('../utils/iptvEpg');
const store = require('../utils/iptvStore');

const xml = `<tv><programme start="20261026120000 +0000" stop="20261026130000 +0000" channel="cnn.us"><title>News Hour</title><desc>Top stories</desc><category>News</category></programme><programme start="20261026130000 +0000" stop="20261026140000 +0000" channel="cnn.us"><title>World</title></programme></tv>`;

test('parses XMLTV into ISO programmes', () => {
  const programmes = parseXmltv(xml);
  assert.equal(programmes.length, 2);
  assert.equal(programmes[0].title, 'News Hour');
  assert.equal(programmes[0].start, '2026-10-26T12:00:00.000Z');
  assert.equal(programmes[0].stop, '2026-10-26T13:00:00.000Z');
  assert.equal(programmes[0].category, 'News');
});

test('now and next respect start and stop boundaries', () => {
  const schedule = parseXmltv(xml);
  assert.equal(getEpg('cnn.us', { now: Date.parse('2026-10-26T12:00:00Z'), schedule }).now.title, 'News Hour');
  assert.equal(getEpg('cnn.us', { now: Date.parse('2026-10-26T13:00:00Z'), schedule }).now.title, 'World');
  assert.equal(getEpg('cnn.us', { now: Date.parse('2026-10-26T13:00:00Z'), schedule }).next, null);
});

test('refreshGuides reads each guide once and prunes seven-day retention', async () => {
  const reads = [];
  const writes = [];
  await refreshGuides({
    now: Date.parse('2026-10-26T12:00:00Z'),
    readText: async (url) => { reads.push(url); return xml; },
    store: {
      listPlaylists: () => [{ id: 1, guide_url: 'https://g/one.xml' }, { id: 2, guide_url: null }],
      replaceEpg: (channelId, programmes) => writes.push({ channelId, count: programmes.length }),
      pruneEpg: (before) => writes.push({ before }),
    },
  });
  assert.deepEqual(reads, ['https://g/one.xml']);
  assert.deepEqual(writes[0], { channelId: 'cnn.us', count: 2 });
  assert.equal(writes.at(-1).before, '2026-10-19T12:00:00.000Z');
});

test('parses entities, any attribute order, and skips malformed entries', () => {
  const messy = `<tv>
    <programme channel="bbc.uk" stop="20261026101500 +0000" start="20261026091500 +0000">
      <title>Breakfast &amp; News &#8211; Live</title>
      <desc><![CDATA[Fresh]]> &lt;stories&gt; &quot;today&quot; &apos;now&apos;</desc>
      <category>News &amp; Current Affairs</category>
    </programme>
    <programme start="20261026110000 +0000" channel="bbc.uk"><title>No stop</title></programme>
    <programme start="20261026110000 +0000" stop="20261026120000 +0000"><title>No channel</title></programme>
    <programme start="20261026110000 +0000" stop="20261026120000 +0000" channel="bbc.uk"></programme>
  </tv>`;
  const programmes = parseXmltv(messy);
  assert.equal(programmes.length, 1);
  assert.equal(programmes[0].channel, 'bbc.uk');
  assert.equal(programmes[0].start, '2026-10-26T09:15:00.000Z');
  assert.equal(programmes[0].title, 'Breakfast & News – Live');
  assert.equal(programmes[0].description, 'Fresh <stories> "today" \'now\'');
  assert.equal(programmes[0].category, 'News & Current Affairs');
});

test('getEpg sorts by start and returns an empty result for unknown channels', () => {
  const shuffled = [
    { channel: 'cnn.us', start: '2026-10-26T13:00:00.000Z', stop: '2026-10-26T14:00:00.000Z', title: 'World' },
    { channel: 'cnn.us', start: '2026-10-26T12:00:00.000Z', stop: '2026-10-26T13:00:00.000Z', title: 'News Hour' },
  ];
  const epg = getEpg('cnn.us', { now: Date.parse('2026-10-26T12:30:00Z'), schedule: shuffled });
  assert.deepEqual(epg.schedule.map((programme) => programme.title), ['News Hour', 'World']);
  assert.equal(epg.now.title, 'News Hour');
  assert.equal(epg.next.title, 'World');

  const empty = getEpg('missing.us', { now: Date.parse('2026-10-26T12:30:00Z'), schedule: [] });
  assert.deepEqual(empty, { now: null, next: null, schedule: [] });
});

test('ingestGuide groups by channel and prunes after replacing', () => {
  const calls = [];
  const result = ingestGuide(xml, {
    now: Date.parse('2026-10-26T12:00:00Z'),
    store: {
      replaceEpg: (channelId, programmes) => calls.push({ channelId, programmes }),
      pruneEpg: (before) => calls.push({ before }),
    },
  });
  assert.equal(result.channels, 1);
  assert.equal(result.programmes, 2);
  assert.equal(calls[0].channelId, 'cnn.us');
  assert.equal(calls[0].programmes.length, 2);
  assert.equal(calls.at(-1).before, '2026-10-19T12:00:00.000Z');
});

test('refreshGuides keeps going when one guide fails', async () => {
  const reads = [];
  const writes = [];
  const result = await refreshGuides({
    now: Date.parse('2026-10-26T12:00:00Z'),
    readText: async (url, options) => {
      reads.push({ url, options });
      if (url.includes('broken')) throw new Error('upstream timed out');
      return { text: xml, status: 200 };
    },
    store: {
      listPlaylists: () => [
        { id: 1, guide_url: 'https://g/broken.xml' },
        { id: 2, guide_url: 'https://g/one.xml' },
        { id: 3, guide_url: '   ' },
      ],
      replaceEpg: (channelId, programmes) => writes.push({ channelId, count: programmes.length }),
      pruneEpg: () => {},
    },
  });
  assert.deepEqual(reads.map((read) => read.url), ['https://g/broken.xml', 'https://g/one.xml']);
  assert.equal(reads[0].options.timeoutMs, 30000);
  assert.equal(result.guides.length, 1);
  assert.equal(result.guides[0].playlistId, 2);
  assert.equal(result.failed.length, 1);
  assert.equal(result.failed[0].playlistId, 1);
  assert.equal(writes[0].channelId, 'cnn.us');
});

test('store replaces, reads, and prunes EPG rows', () => {
  store.ensureIptvTables();
  store.replaceEpg('cnn.us', parseXmltv(xml));

  const window = { from: '2026-10-26T11:00:00.000Z', to: '2026-10-26T14:00:00.000Z' };
  const rows = store.getEpgProgrammes('cnn.us', window);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].title, 'News Hour');
  assert.equal(rows[0].description, 'Top stories');
  assert.equal(rows[0].channel, 'cnn.us');

  // Replacing a channel drops the old rows instead of appending.
  store.replaceEpg('cnn.us', [rows[1]]);
  assert.equal(store.getEpgProgrammes('cnn.us', window).length, 1);

  assert.equal(store.pruneEpg('2026-10-26T13:30:00.000Z'), 0);
  assert.equal(store.pruneEpg('2026-10-26T14:30:00.000Z'), 1);
  assert.equal(store.getEpgProgrammes('cnn.us', window).length, 0);

  // getEpg with no injected schedule loads the bounded window from the store.
  store.replaceEpg('cnn.us', parseXmltv(xml));
  const live = getEpg('cnn.us', { now: Date.parse('2026-10-26T12:15:00Z') });
  assert.equal(live.now.title, 'News Hour');
  assert.equal(live.next.title, 'World');
});
