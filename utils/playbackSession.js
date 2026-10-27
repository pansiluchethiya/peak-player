'use strict';

const { randomUUID } = require('node:crypto');

const SESSION_TTL_MS = 10 * 60 * 1000;
const MAX_SOURCES = 4;

const sessions = new Map();

function publicSource(source) {
  if (!source || typeof source !== 'object') return source;
  const { _order, ...rest } = source;
  return rest;
}

async function createPlaybackSession({
  type,
  id,
  season,
  episode,
  serverUrl,
  config,
  resolve,
  now = Date.now(),
} = {}) {
  const resolver = resolve || ((options) => require('./playerService').getPlayerStream(options));
  const payload = await resolver({ type, id, season, episode, serverUrl, config });
  const sources = Array.isArray(payload?.sources)
    ? payload.sources.slice(0, MAX_SOURCES).map(publicSource)
    : [];
  const sessionId = randomUUID();
  const session = {
    sessionId,
    type: payload?.type || type,
    id: payload?.id ?? id,
    title: payload?.title || 'Untitled',
    year: payload?.year,
    season: season ?? null,
    episode: episode ?? null,
    sources,
    subtitles: Array.isArray(payload?.subtitles) ? payload.subtitles : [],
    diagnostics: Array.isArray(payload?.diagnostics) ? payload.diagnostics : [],
    meta: payload?.meta || {},
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  };
  sessions.set(sessionId, session);
  return session;
}

function getPlaybackSession(sessionId, now = Date.now()) {
  const session = sessions.get(String(sessionId || ''));
  if (!session) return null;
  if (session.expiresAt <= now) {
    sessions.delete(String(sessionId));
    return null;
  }
  return session;
}

function clearPlaybackSessions() {
  sessions.clear();
}

module.exports = {
  MAX_SOURCES,
  SESSION_TTL_MS,
  clearPlaybackSessions,
  createPlaybackSession,
  getPlaybackSession,
};
