'use strict';

const assert = require('node:assert/strict');
const { beforeEach, describe, it } = require('node:test');
const {
  MAX_SOURCES,
  SESSION_TTL_MS,
  clearPlaybackSessions,
  createPlaybackSession,
  getPlaybackSession,
} = require('../utils/playbackSession');

const sources = Array.from({ length: 6 }, (_, index) => ({
  url: `https://cdn.example/${index}.m3u8`,
  quality: '1080p',
  codec: 'hls',
  provider: 'alpha',
  _order: index,
}));

beforeEach(() => {
  clearPlaybackSessions();
});

describe('playbackSession', () => {
  it('stores at most four public sources and strips internal ordering fields', async () => {
    const session = await createPlaybackSession({
      type: 'movie',
      id: '550',
      serverUrl: 'http://peak.test',
      resolve: async () => ({
        id: '550',
        type: 'movie',
        title: 'Test Movie',
        sources,
        subtitles: [{ url: 'https://cdn.example/en.vtt', lang: 'en' }],
        diagnostics: [],
        meta: { sources: 6 },
      }),
    });

    assert.equal(session.sources.length, MAX_SOURCES);
    assert.equal(session.sources[0]._order, undefined);
    assert.equal(session.expiresAt, session.createdAt + SESSION_TTL_MS);
    assert.equal(getPlaybackSession(session.sessionId)?.title, 'Test Movie');
  });

  it('expires sessions and removes them on lookup', async () => {
    const session = await createPlaybackSession({
      type: 'movie',
      id: '550',
      now: 1000,
      resolve: async () => ({ id: '550', type: 'movie', sources: [] }),
    });

    assert.equal(getPlaybackSession(session.sessionId, 1000 + SESSION_TTL_MS - 1)?.sessionId, session.sessionId);
    assert.equal(getPlaybackSession(session.sessionId, 1000 + SESSION_TTL_MS), null);
  });
});
