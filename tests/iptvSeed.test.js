'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.PEAK_DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'peak-iptv-seed-')), 'test.db');
const { seedIptv } = require('../utils/iptvSeed');

test('sports are always seeded; category and country filters apply to the rest', async () => {
  const fixtures = {
    'channels.json': [
      { id: 'espn.us', name: 'ESPN', country: 'US', categories: ['sports'], logo: 'espn.png' },
      { id: 'cnn.us', name: 'CNN', country: 'US', categories: ['news'] },
      { id: 'bbc.uk', name: 'BBC News', country: 'GB', categories: ['news'] },
    ],
    'streams.json': [
      { channel: 'espn.us', url: 'https://a/espn.m3u8' },
      { channel: 'cnn.us', url: 'https://a/cnn.m3u8' },
      { channel: 'bbc.uk', url: 'https://a/bbc.m3u8' },
    ],
    'categories.json': [{ id: 'sports', name: 'Sports' }, { id: 'news', name: 'News' }],
    'countries.json': [{ code: 'US', name: 'United States' }, { code: 'GB', name: 'United Kingdom' }],
    'languages.json': [{ code: 'en', name: 'English' }],
    'guides.json': [],
    'logos.json': [],
  };
  const readJson = async (url) => fixtures[url.split('/').pop()];
  const result = await seedIptv({ config: { enabled: true, categories: ['news'], countries: ['US'] }, readJson });
  assert.deepEqual(result.channels.map((c) => c.name).sort(), ['CNN', 'ESPN']);
});
