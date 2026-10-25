'use strict';

const assert = require('node:assert/strict');
const { afterEach, describe, it } = require('node:test');
const {
  DEFAULT_TTL_SECONDS,
  MAX_TTL_SECONDS,
  MIN_TTL_SECONDS,
  getEmbedTokenSecret,
  normalizeTtlSeconds,
  signEmbedToken,
  verifyEmbedToken,
} = require('../utils/embedToken');

const SECRET = 'embed-test-secret';
const NOW = 1_700_000_000_000;

afterEach(() => {
  delete process.env.EMBED_TOKEN_SECRET;
});

describe('embed token', () => {
  it('signs and verifies a payload with an expiry', () => {
    const token = signEmbedToken(
      { partnerId: 'demo', type: 'movie', id: '550', origins: ['https://partner.example'] },
      { secret: SECRET, now: NOW, ttlSeconds: 900 },
    );

    assert.equal(token.split('.').length, 2);
    const result = verifyEmbedToken(token, { secret: SECRET, now: NOW + 1000 });
    assert.equal(result.ok, true);
    assert.equal(result.error, null);
    assert.equal(result.payload.partnerId, 'demo');
    assert.equal(result.payload.type, 'movie');
    assert.equal(result.payload.id, '550');
    assert.deepEqual(result.payload.origins, ['https://partner.example']);
    assert.equal(result.payload.exp, Math.floor(NOW / 1000) + 900);
    assert.equal(result.payload.iat, Math.floor(NOW / 1000));
  });

  it('rejects a missing, malformed, or tampered token', () => {
    assert.equal(verifyEmbedToken('', { secret: SECRET }).error, 'MISSING_TOKEN');
    assert.equal(verifyEmbedToken('not-a-token', { secret: SECRET }).error, 'INVALID_TOKEN');

    const token = signEmbedToken({ partnerId: 'demo' }, { secret: SECRET, now: NOW });
    const [payload, signature] = token.split('.');
    const forgedPayload = Buffer.from(JSON.stringify({ partnerId: 'other', exp: 9_999_999_999 }))
      .toString('base64url');

    assert.equal(verifyEmbedToken(`${forgedPayload}.${signature}`, { secret: SECRET, now: NOW }).error, 'INVALID_SIGNATURE');
    assert.equal(verifyEmbedToken(`${payload}.${signature.slice(0, -1)}x`, { secret: SECRET, now: NOW }).error, 'INVALID_SIGNATURE');
    assert.equal(verifyEmbedToken(token, { secret: 'wrong-secret', now: NOW }).error, 'INVALID_SIGNATURE');
  });

  it('rejects an expired token', () => {
    const token = signEmbedToken({ partnerId: 'demo' }, { secret: SECRET, now: NOW, ttlSeconds: 60 });
    const result = verifyEmbedToken(token, { secret: SECRET, now: NOW + 60_000 });
    assert.equal(result.ok, false);
    assert.equal(result.error, 'EXPIRED');
    assert.equal(result.payload.partnerId, 'demo');
  });

  it('rejects a token without a usable expiry', () => {
    const payload = Buffer.from(JSON.stringify({ partnerId: 'demo' })).toString('base64url');
    const crypto = require('node:crypto');
    const signature = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
    assert.equal(verifyEmbedToken(`${payload}.${signature}`, { secret: SECRET, now: NOW }).error, 'INVALID_PAYLOAD');
  });

  it('clamps token lifetimes to the supported range', () => {
    assert.equal(MIN_TTL_SECONDS, 60);
    assert.equal(MAX_TTL_SECONDS, 24 * 60 * 60);
    assert.equal(DEFAULT_TTL_SECONDS, 15 * 60);
    assert.equal(normalizeTtlSeconds(undefined), DEFAULT_TTL_SECONDS);
    assert.equal(normalizeTtlSeconds(1), MIN_TTL_SECONDS);
    assert.equal(normalizeTtlSeconds(999_999), MAX_TTL_SECONDS);
    assert.equal(normalizeTtlSeconds('120'), 120);
    assert.equal(normalizeTtlSeconds('nope'), DEFAULT_TTL_SECONDS);
  });

  it('uses a configured secret and falls back to a stable ephemeral one', () => {
    process.env.EMBED_TOKEN_SECRET = 'configured-embed-secret';
    assert.equal(getEmbedTokenSecret(), 'configured-embed-secret');

    delete process.env.EMBED_TOKEN_SECRET;
    const first = getEmbedTokenSecret();
    const second = getEmbedTokenSecret();
    assert.ok(first.length >= 32);
    assert.equal(first, second);
  });
});
