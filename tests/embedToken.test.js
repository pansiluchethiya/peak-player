'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
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

function encrypt(payload, secret = SECRET) {
  const key = crypto.createHash('sha256').update(secret, 'utf8').digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  return [
    'v1',
    iv.toString('base64url'),
    ciphertext.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
  ].join('.');
}

afterEach(() => {
  delete process.env.EMBED_TOKEN_SECRET;
});

describe('embed token', () => {
  it('signs and verifies an opaque payload with an expiry', () => {
    const token = signEmbedToken(
      { partnerId: 'demo', type: 'movie', id: '550', origins: ['https://partner.example'] },
      { secret: SECRET, now: NOW, ttlSeconds: 900 },
    );

    assert.equal(token.split('.').length, 4);
    assert.equal(token.startsWith('v1.'), true);
    assert.equal(token.includes('partnerId'), false);
    assert.equal(token.includes(Buffer.from('demo').toString('base64url')), false);

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
    assert.equal(verifyEmbedToken('a.b.c', { secret: SECRET }).error, 'INVALID_TOKEN');

    const token = signEmbedToken({ partnerId: 'demo' }, { secret: SECRET, now: NOW });
    const [version, iv, ciphertext, tag] = token.split('.');
    const forged = encrypt({ partnerId: 'other', exp: 9_999_999_999 });

    assert.equal(
      verifyEmbedToken(forged, { secret: SECRET, now: NOW }).payload.partnerId,
      'other',
    );
    assert.equal(
      verifyEmbedToken(`${version}.${iv}.${ciphertext.slice(0, -1)}x.${tag}`, {
        secret: SECRET,
        now: NOW,
      }).error,
      'INVALID_SIGNATURE',
    );
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
    assert.equal(
      verifyEmbedToken(encrypt({ partnerId: 'demo' }), { secret: SECRET, now: NOW }).error,
      'INVALID_PAYLOAD',
    );
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
