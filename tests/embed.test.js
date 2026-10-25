'use strict';

const assert = require('node:assert/strict');
const { afterEach, beforeEach, describe, it } = require('node:test');
const {
  DEFAULT_PLAYER_URL,
  buildEmbedUrl,
  buildPlayerUrl,
  createEmbedSession,
  getEmbed,
} = require('../utils/embed');
const { parseEmbedPartners, findPartnerByApiKey, getPartner, getPartnerOrigins } = require('../utils/embedPartners');
const { verifyEmbedToken } = require('../utils/embedToken');

const PARTNERS = JSON.stringify([
  {
    id: 'demo',
    name: 'Demo Partner',
    apiKey: 'demo-api-key-with-enough-length',
    origins: ['https://partner.example', 'https://www.partner.example/'],
  },
  {
    id: 'wildcard',
    name: 'Wildcard Partner',
    apiKey: 'wildcard-api-key-with-enough-length',
    origins: ['*'],
  },
]);

beforeEach(() => {
  process.env.EMBED_PARTNERS = PARTNERS;
  process.env.EMBED_TOKEN_SECRET = 'embed-test-secret';
  process.env.PLAYER_PUBLIC_URL = 'https://player.peak.example/';
  delete process.env.NODE_ENV;
});

afterEach(() => {
  delete process.env.EMBED_PARTNERS;
  delete process.env.EMBED_TOKEN_SECRET;
  delete process.env.PLAYER_PUBLIC_URL;
  delete process.env.NODE_ENV;
});

describe('embed partners', () => {
  it('parses partners, normalizes origins, and rejects wildcard origins', () => {
    const partners = parseEmbedPartners(PARTNERS);
    assert.equal(partners.length, 1);
    assert.equal(partners[0].id, 'demo');
    assert.deepEqual(partners[0].origins, ['https://partner.example', 'https://www.partner.example']);
    assert.equal(partners[0].apiKey, undefined);

    assert.equal(findPartnerByApiKey('demo-api-key-with-enough-length')?.id, 'demo');
    assert.equal(findPartnerByApiKey('wildcard-api-key-with-enough-length'), null);
    assert.equal(findPartnerByApiKey('wrong'), null);
    assert.equal(getPartner('demo')?.name, 'Demo Partner');
    assert.equal(getPartner('missing'), null);
    assert.deepEqual(getPartnerOrigins('demo'), ['https://partner.example', 'https://www.partner.example']);
    assert.deepEqual(getPartnerOrigins('missing'), []);
  });

  it('ignores malformed partner configuration', () => {
    assert.deepEqual(parseEmbedPartners('not json'), []);
    assert.deepEqual(parseEmbedPartners(JSON.stringify({ id: 'demo' })), []);
    assert.deepEqual(parseEmbedPartners(JSON.stringify([{ id: 'demo', apiKey: 'short', origins: [] }])), []);
  });
});

describe('embed URLs', () => {
  it('builds player URLs for movies, TV, and live channels', () => {
    assert.equal(buildPlayerUrl({ type: 'movie', id: '550' }), 'https://player.peak.example/movie/550');
    assert.equal(
      buildPlayerUrl({ type: 'tv', id: '1399', season: 2, episode: 7, poster: '/poster.jpg' }),
      'https://player.peak.example/tv/1399/2/7?poster=%2Fposter.jpg',
    );
    assert.equal(
      buildPlayerUrl({ type: 'live_tv', id: 'channel_bbc_one_abc123' }),
      'https://player.peak.example/live/channel_bbc_one_abc123',
    );
  });

  it('builds signed embed URLs with an encoded token', () => {
    const url = buildEmbedUrl(
      { type: 'movie', id: '550', poster: 'https://image.example/poster.jpg' },
      'header.payload',
    );
    const parsed = new URL(url);
    assert.equal(parsed.origin, 'https://player.peak.example');
    assert.equal(parsed.pathname, '/embed/movie/550');
    assert.equal(parsed.searchParams.get('token'), 'header.payload');
    assert.equal(parsed.searchParams.get('poster'), 'https://image.example/poster.jpg');
  });

  it('requires PLAYER_PUBLIC_URL in production and defaults to localhost in development', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.PLAYER_PUBLIC_URL;
    assert.throws(
      () => buildPlayerUrl({ type: 'movie', id: '550' }),
      (error) => error.code === 'PLAYER_PUBLIC_URL_REQUIRED',
    );

    process.env.NODE_ENV = 'development';
    assert.equal(
      buildPlayerUrl({ type: 'movie', id: '550' }),
      `${DEFAULT_PLAYER_URL}/movie/550`,
    );
  });

  it('rejects an invalid public player URL', () => {
    process.env.PLAYER_PUBLIC_URL = 'javascript:alert(1)';
    assert.throws(
      () => buildPlayerUrl({ type: 'movie', id: '550' }),
      (error) => error.code === 'INVALID_PLAYER_PUBLIC_URL',
    );
  });
});

describe('embed sessions', () => {
  it('rejects a missing or unknown API key', async () => {
    const missing = await createEmbedSession({ type: 'movie', id: '550' });
    assert.equal(missing.status, 401);
    assert.equal(missing.error, 'INVALID_API_KEY');

    const unknown = await createEmbedSession({
      apiKey: 'wrong-key',
      type: 'movie',
      id: '550',
    });
    assert.equal(unknown.status, 401);
    assert.equal(unknown.error, 'INVALID_API_KEY');
  });

  it('creates a signed session scoped to the partner and media', async () => {
    const now = 1_700_000_000_000;
    const session = await createEmbedSession({
      apiKey: 'demo-api-key-with-enough-length',
      type: 'tv',
      id: '1399',
      season: 2,
      episode: 7,
      poster: 'https://image.example/poster.jpg',
      ttlSeconds: 300,
      now,
    });

    assert.equal(session.status, 200);
    assert.equal(session.partner.id, 'demo');
    assert.deepEqual(session.origins, ['https://partner.example', 'https://www.partner.example']);
    assert.equal(session.type, 'tv');
    assert.equal(session.id, '1399');
    assert.equal(session.season, 2);
    assert.equal(session.episode, 7);
    assert.equal(session.expiresAt, new Date(now + 300_000).toISOString());
    assert.equal(session.url, session.embedUrl);
    assert.match(session.url, /\/embed\/tv\/1399\/2\/7\?/);

    const parsed = new URL(session.url);
    const token = parsed.searchParams.get('token');
    const verified = verifyEmbedToken(token, { secret: 'embed-test-secret', now });
    assert.equal(verified.ok, true);
    assert.equal(verified.payload.partnerId, 'demo');
    assert.equal(verified.payload.type, 'tv');
    assert.equal(verified.payload.id, '1399');
    assert.deepEqual(verified.payload.origins, ['https://partner.example', 'https://www.partner.example']);
    assert.equal(JSON.stringify(session).includes('demo-api-key-with-enough-length'), false);
  });

  it('returns validation errors from the embed builder', async () => {
    const result = await createEmbedSession({
      apiKey: 'demo-api-key-with-enough-length',
      type: 'movie',
      id: 'not-a-number',
    });
    assert.equal(result.status, 400);
    assert.equal(result.error, 'INVALID_ID');
  });

  it('keeps the legacy embed response compatible', async () => {
    const result = await getEmbed({
      type: 'movie',
      id: '550',
      poster: 'https://image.example/poster.jpg',
    });
    assert.equal(result.status, 200);
    assert.equal(result.provider, 'Peak Player');
    assert.equal(result.url, 'https://player.peak.example/movie/550?poster=https%3A%2F%2Fimage.example%2Fposter.jpg');
  });
});
