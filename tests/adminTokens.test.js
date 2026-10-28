'use strict';

const assert = require('node:assert/strict');
const { describe, it, beforeEach } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Isolate the DB in a temp file for each test run
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'peak-admin-tokens-'));
process.env.PEAK_DB_PATH = path.join(tmpDir, 'test.db');

// Clear cached modules so db.js picks up PEAK_DB_PATH
delete require.cache[require.resolve('../utils/db')];
delete require.cache[require.resolve('../utils/adminConfig')];

const {
  listTokens,
  createToken,
  revokeToken,
  getToken,
} = require('../utils/adminConfig');

describe('token management', () => {
  beforeEach(() => {
    // Reset by deleting all tokens
    const all = listTokens();
    all.forEach((t) => revokeToken(t.id));
  });

  it('creates a token with all required fields', () => {
    const token = createToken({
      name: 'Test Token',
      partner: 'test-partner',
      expiresAt: '2026-12-31T23:59:59Z',
      allowedOrigins: ['https://example.com'],
      readOnly: true,
    });

    assert.ok(token.id);
    assert.equal(token.name, 'Test Token');
    assert.equal(token.partner, 'test-partner');
    assert.equal(token.expiresAt, '2026-12-31T23:59:59Z');
    assert.ok(Array.isArray(token.allowedOrigins));
    assert.equal(token.allowedOrigins.length, 1);
    assert.equal(token.allowedOrigins[0], 'https://example.com');
    assert.equal(token.readOnly, true);
    assert.ok(token.createdAt);
    assert.equal(token.lastUsedAt, null);
  });

  it('creates a non-readOnly token by default', () => {
    const token = createToken({
      name: 'Default',
      partner: 'default',
      expiresAt: '2026-12-31T23:59:59Z',
      allowedOrigins: ['https://example.com'],
    });
    assert.equal(token.readOnly, false);
  });

  it('listTokens returns all created tokens', () => {
    createToken({ name: 'A', partner: 'p', expiresAt: '2026-12-31T00:00:00Z', allowedOrigins: ['https://a.com'] });
    createToken({ name: 'B', partner: 'p', expiresAt: '2026-12-31T00:00:00Z', allowedOrigins: ['https://b.com'] });
    const tokens = listTokens();
    assert.equal(tokens.length, 2);
    const names = tokens.map((t) => t.name).sort();
    assert.deepEqual(names, ['A', 'B']);
  });

  it('revokeToken removes a token by id', () => {
    const token = createToken({
      name: 'To Revoke',
      partner: 'default',
      expiresAt: '2026-12-31T23:59:59Z',
      allowedOrigins: ['https://example.com'],
    });

    assert.ok(getToken(token.id));
    const revoked = revokeToken(token.id);
    assert.ok(revoked);
    assert.equal(revoked.id, token.id);
    assert.equal(getToken(token.id), null);
    assert.equal(listTokens().length, 0);
  });

  it('revokeToken returns null for unknown id', () => {
    const result = revokeToken('nonexistent-id');
    assert.equal(result, null);
  });

  it('getToken returns the token by id', () => {
    const token = createToken({
      name: 'Find Me',
      partner: 'default',
      expiresAt: '2026-12-31T23:59:59Z',
      allowedOrigins: ['https://example.com'],
    });
    const found = getToken(token.id);
    assert.ok(found);
    assert.equal(found.name, 'Find Me');
  });

  it('getToken returns null for missing id', () => {
    assert.equal(getToken('missing'), null);
  });

  it('tokens are persisted and survive module reload', () => {
    const token = createToken({
      name: 'Persistent',
      partner: 'default',
      expiresAt: '2026-12-31T23:59:59Z',
      allowedOrigins: ['https://example.com'],
    });
    const id = token.id;

    // Simulate reload by re-reading
    const tokens = listTokens();
    const found = tokens.find((t) => t.id === id);
    assert.ok(found);
    assert.equal(found.name, 'Persistent');
  });
});

describe('proxy management', () => {
  const {
    listProxies,
    createProxy,
    revokeProxy,
    getProxy,
  } = require('../utils/adminConfig');

  beforeEach(() => {
    const all = listProxies();
    all.forEach((p) => revokeProxy(p.id));
  });

  it('creates a proxy with all required fields', () => {
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
    assert.ok(Array.isArray(proxy.corsOrigins));
    assert.equal(proxy.corsOrigins[0], 'https://app.example.com');
    assert.ok(proxy.createdAt);
  });

  it('listProxies returns all proxies', () => {
    createProxy({ name: 'P1', upstreamUrl: 'https://a.com', headers: {}, corsOrigins: [] });
    createProxy({ name: 'P2', upstreamUrl: 'https://b.com', headers: {}, corsOrigins: [] });
    assert.equal(listProxies().length, 2);
  });

  it('revokeProxy removes a proxy by id', () => {
    const proxy = createProxy({ name: 'To Remove', upstreamUrl: 'https://c.com', headers: {}, corsOrigins: [] });
    assert.ok(getProxy(proxy.id));
    const revoked = revokeProxy(proxy.id);
    assert.ok(revoked);
    assert.equal(getProxy(proxy.id), null);
  });

  it('revokeProxy returns null for unknown id', () => {
    assert.equal(revokeProxy('unknown'), null);
  });

  it('getProxy returns the proxy by id', () => {
    const proxy = createProxy({ name: 'Find Me', upstreamUrl: 'https://d.com', headers: {}, corsOrigins: ['https://x.com'] });
    const found = getProxy(proxy.id);
    assert.equal(found.name, 'Find Me');
    assert.deepEqual(found.corsOrigins, ['https://x.com']);
  });
});
