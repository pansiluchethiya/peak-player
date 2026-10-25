'use strict';

const assert = require('node:assert/strict');
const { afterEach, describe, it } = require('node:test');
const {
  DEFAULT_TTL_SECONDS,
  canonicalQuery,
  getProxySecret,
  signProxyParams,
  signProxyUrl,
  verifyProxyQuery,
  verifyProxyRequest,
} = require('../utils/proxySigner');

function queryOf(url) {
  return Object.fromEntries(new URL(url, 'http://peak.test').searchParams.entries());
}

const SECRET = 'test-proxy-secret';
const PARAMS = {
  url: 'https://cdn.example/movie/master.m3u8',
  headers: JSON.stringify({ Referer: 'https://partner.example/' }),
};

afterEach(() => {
  delete process.env.PROXY_SIGNING_SECRET;
});

describe('proxy signer', () => {
  it('signs a URL with an expiry and verifies it', () => {
    const signed = signProxyUrl('/ts-proxy', PARAMS, {
      secret: SECRET,
      now: 1_000_000,
      ttlSeconds: 60,
    });
    const query = queryOf(signed);

    assert.equal(query.exp, '1060');
    assert.ok(query.sig);
    assert.equal(
      verifyProxyRequest('/ts-proxy', query, { secret: SECRET, now: 1_000_001 }).ok,
      true,
    );
  });

  it('produces a stable signature regardless of parameter order', () => {
    const first = signProxyParams('/m3u8-proxy', { a: '1', b: '2' }, {
      secret: SECRET,
      now: 5_000,
    });
    const second = signProxyParams('/m3u8-proxy', { b: '2', a: '1' }, {
      secret: SECRET,
      now: 5_000,
    });

    assert.equal(first.sig, second.sig);
    assert.equal(canonicalQuery({ b: '2', a: '1' }), 'a=1&b=2');
  });

  it('rejects a missing signature', () => {
    const result = verifyProxyRequest('/ts-proxy', { url: PARAMS.url }, { secret: SECRET });
    assert.deepEqual(result, { ok: false, reason: 'missing_signature' });
  });

  it('rejects tampered parameters', () => {
    const signed = signProxyParams('/ts-proxy', PARAMS, { secret: SECRET, now: 1_000 });
    const result = verifyProxyRequest(
      '/ts-proxy',
      { ...signed, url: 'https://evil.example/other.m3u8' },
      { secret: SECRET, now: 1_000 },
    );
    assert.deepEqual(result, { ok: false, reason: 'invalid_signature' });
  });

  it('rejects an expired signature', () => {
    const signed = signProxyParams('/ts-proxy', PARAMS, {
      secret: SECRET,
      now: 1_000,
      ttlSeconds: 5,
    });
    const result = verifyProxyRequest('/ts-proxy', signed, { secret: SECRET, now: 6_000 });
    assert.deepEqual(result, { ok: false, reason: 'expired' });
  });

  it('rejects a signature made with a different secret', () => {
    const signed = signProxyParams('/ts-proxy', PARAMS, { secret: 'other', now: 1_000 });
    const result = verifyProxyRequest('/ts-proxy', signed, { secret: SECRET, now: 1_000 });
    assert.deepEqual(result, { ok: false, reason: 'invalid_signature' });
  });

  it('exposes a boolean verifier and defaults to a six-hour TTL', () => {
    const signed = signProxyParams('/sub-proxy', { url: PARAMS.url }, {
      secret: SECRET,
      now: 0,
    });
    assert.equal(signed.exp, String(DEFAULT_TTL_SECONDS));
    assert.equal(verifyProxyQuery('/sub-proxy', signed, { secret: SECRET, now: 1 }), true);
    assert.equal(verifyProxyQuery('/sub-proxy', { ...signed, url: 'x' }, { secret: SECRET, now: 1 }), false);
  });

  it('uses a configured secret and falls back to a stable ephemeral one', () => {
    process.env.PROXY_SIGNING_SECRET = 'configured-secret';
    assert.equal(getProxySecret(), 'configured-secret');

    delete process.env.PROXY_SIGNING_SECRET;
    const first = getProxySecret();
    const second = getProxySecret();
    assert.ok(first.length >= 32);
    assert.equal(first, second);
  });
});
