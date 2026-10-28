import assert from 'node:assert/strict';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';
import {
  buildFrameAncestors,
  normalizeEmbedOrigins,
  verifyEmbedToken,
} from '../src/lib/embedToken';

const SECRET = 'test-embed-secret';

function token(payload: Record<string, unknown>, secret = SECRET): string {
  const key = createHash('sha256').update(secret, 'utf8').digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
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

function payload(overrides: Record<string, unknown> = {}) {
  return {
    v: 1,
    partnerId: 'partner-a',
    type: 'movie',
    id: '550',
    origins: ['https://partner.example'],
    iat: 1_000,
    exp: 2_000,
    ...overrides,
  };
}

describe('edge embed token verification', () => {
  it('verifies a valid token and returns its payload', async () => {
    const result = await verifyEmbedToken(token(payload()), { secret: SECRET, now: 1_500 });

    assert.equal(result.ok, true);
    assert.equal(result.payload?.partnerId, 'partner-a');
    assert.equal(result.payload?.id, '550');
  });

  it('keeps the token opaque', () => {
    const encoded = token(payload());
    assert.equal(encoded.split('.').length, 4);
    assert.equal(encoded.startsWith('v1.'), true);
    assert.equal(encoded.includes('partnerId'), false);
  });

  it('rejects a tampered token', async () => {
    const signed = token(payload());
    const [version, iv, ciphertext, tag] = signed.split('.');
    const tampered = `${version}.${iv}.${ciphertext.slice(0, -1)}x.${tag}`;

    const result = await verifyEmbedToken(tampered, {
      secret: SECRET,
      now: 1_500,
    });

    assert.deepEqual(result, { ok: false, error: 'INVALID_SIGNATURE' });
  });

  it('rejects an expired token', async () => {
    const result = await verifyEmbedToken(token(payload()), { secret: SECRET, now: 2_001_000 });
    assert.equal(result.ok, false);
    assert.equal(result.error, 'EXPIRED');
    assert.equal(result.payload?.partnerId, 'partner-a');
  });

  it('rejects missing and malformed tokens', async () => {
    assert.deepEqual(await verifyEmbedToken('', { secret: SECRET }), {
      ok: false,
      error: 'MISSING_TOKEN',
    });
    assert.deepEqual(await verifyEmbedToken('not-a-token', { secret: SECRET }), {
      ok: false,
      error: 'INVALID_TOKEN',
    });
    assert.deepEqual(await verifyEmbedToken('a.b.c', { secret: SECRET }), {
      ok: false,
      error: 'INVALID_TOKEN',
    });
    assert.deepEqual(await verifyEmbedToken('v1.a.b.c', { secret: SECRET }), {
      ok: false,
      error: 'INVALID_TOKEN',
    });
  });

  it('fails closed when no secret is configured', async () => {
    const result = await verifyEmbedToken(token(payload()), { secret: '', now: 1_500 });
    assert.deepEqual(result, { ok: false, error: 'SECRET_MISSING' });
  });

  it('normalizes exact HTTP origins and rejects wildcards and paths', () => {
    assert.deepEqual(
      normalizeEmbedOrigins([
        'https://partner.example/watch',
        'http://localhost:3000',
        '*',
        'https://*.example.com',
        'javascript:alert(1)',
        'https://partner.example',
      ]),
      ['https://partner.example', 'http://localhost:3000'],
    );
    assert.deepEqual(normalizeEmbedOrigins('https://partner.example'), []);
  });

  it('builds a frame-ancestors policy with self and no wildcard', () => {
    assert.equal(
      buildFrameAncestors(['https://partner.example', 'http://localhost:3000']),
      "frame-ancestors 'self' https://partner.example http://localhost:3000",
    );
    assert.equal(buildFrameAncestors([]), "frame-ancestors 'self'");
    assert.equal(buildFrameAncestors(['*']), "frame-ancestors 'self'");
  });
});
