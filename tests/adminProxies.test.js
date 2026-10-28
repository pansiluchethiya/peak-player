'use strict';

const assert = require('node:assert/strict');
const { describe, it, beforeEach } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Isolate the DB in a temp file
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'peak-admin-proxies-'));
process.env.PEAK_DB_PATH = path.join(tmpDir, 'test.db');

delete require.cache[require.resolve('../utils/db')];
delete require.cache[require.resolve('../utils/adminConfig')];

const {
  listProxies,
  createProxy,
  revokeProxy,
  getProxy,
} = require('../utils/adminConfig');

describe('proxy management', () => {
  beforeEach(() => {
    const all = listProxies();
    all.forEach((p) => revokeProxy(p.id));
  });

  it('creates a proxy with required fields', () => {
    const proxy = createProxy({
      name: 'Test Proxy',
      upstreamUrl: 'https://upstream.example.com',
      headers: { 'X-Custom': 'value' },
      corsOrigins: ['https://app.example.com'],
    });

    assert.ok(proxy.id);
    assert.equal(proxy.name, 'Test Proxy');
    assert.equal(proxy.upstreamUrl, 'https://upstream.example.com');
    assert.deepEqual(proxy.headers, { 'X-Custom': 'value' });
    assert.deepEqual(proxy.corsOrigins, ['https://app.example.com']);
    assert.ok(proxy.createdAt);
  });

  it('listProxies returns all proxies', () => {
    const a = createProxy({ name: 'A', upstreamUrl: 'https://a.com', headers: {}, corsOrigins: [] });
    const b = createProxy({ name: 'B', upstreamUrl: 'https://b.com', headers: {}, corsOrigins: [] });
    const proxies = listProxies();
    assert.equal(proxies.length, 2);
    assert.ok(proxies.find((p) => p.id === a.id));
    assert.ok(proxies.find((p) => p.id === b.id));
  });

  it('revokeProxy removes a proxy by id', () => {
    const proxy = createProxy({ name: 'To Revoke', upstreamUrl: 'https://c.com', headers: {}, corsOrigins: [] });
    assert.ok(getProxy(proxy.id));
    const revoked = revokeProxy(proxy.id);
    assert.ok(revoked);
    assert.equal(getProxy(proxy.id), null);
  });

  it('revokeProxy returns null for unknown id', () => {
    assert.equal(revokeProxy('nonexistent'), null);
  });

  it('creates proxy with string headers (JSON parsed)', () => {
    const proxy = createProxy({
      name: 'JSON Headers',
      upstreamUrl: 'https://e.com',
      headers: '{"User-Agent": "Peak"}',
      corsOrigins: ['https://app.example.com'],
    });
    assert.deepEqual(proxy.headers, { 'User-Agent': 'Peak' });
  });

  it('handles multiple CORS origins', () => {
    const proxy = createProxy({
      name: 'Multi-CORS',
      upstreamUrl: 'https://f.com',
      headers: {},
      corsOrigins: ['https://a.com', 'https://b.com', 'https://c.com'],
    });
    assert.equal(proxy.corsOrigins.length, 3);
  });
});
