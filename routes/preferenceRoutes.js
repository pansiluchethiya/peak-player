'use strict';

const { isValidPreferenceMode, resolvePreferenceMode } = (() => {
  function isValidPreferenceMode(value) {
    return value === 'browser' || value === 'server' || value === 'user';
  }
  function resolvePreferenceMode(globalMode, tokenMode, viewerMode) {
    if (typeof tokenMode === 'string' && isValidPreferenceMode(tokenMode)) return tokenMode;
    if (typeof globalMode === 'string' && isValidPreferenceMode(globalMode)) return globalMode;
    if (typeof viewerMode === 'string' && isValidPreferenceMode(viewerMode)) return viewerMode;
    return 'browser';
  }
  return { isValidPreferenceMode, resolvePreferenceMode };
})();

const VALID_MODES = ['browser', 'server', 'user'];

function getViewerId(req) {
  return req.cookies?.peak_vid || req.session?.peak_vid || null;
}

function issueCookie(res) {
  if (res.getHeader) {
    res.setHeader('Set-Cookie', `__Host-peak_vid=${crypto.randomUUID().replace(/-/g, '')}; HttpOnly; SameSite=Lax; Max-Age=31536000; Path=/`);
  }
}

function readRaw(req) {
  if (typeof req.body === 'object' && req.body !== null) {
    const p = req.body.preferences;
    const locked = req.body.locked;
    if (p) return { preferences: p, locked: Array.isArray(locked) ? locked : undefined };
  }
  return {};
}

function createPreferenceRoutes(app, options = {}) {
  const { mode: globalMode, store, requireAuth } = options;
  const modeValue = typeof globalMode === 'function' ? undefined : globalMode;

  app.get('/api/v1/preferences', (req, res) => {
    const tokenMode = req.headers['x-peak-embed-prefs-mode'];
    const effective = typeof globalMode === 'function' ? globalMode(req) : resolvePreferenceMode(modeValue, tokenMode);
    if (effective === 'browser') {
      return res.status(403).json({ success: false, error: 'PREFERENCES_DISABLED' });
    }
    const viewerId = getViewerId(req);
    if (!viewerId) {
      if (requireAuth) return requireAuth(req, res);
      return res.status(401).json({ success: false, error: 'AUTH_REQUIRED' });
    }
    const prefs = store ? store.readPreferences(viewerId) : null;
    if (!prefs) return res.status(404).json({ success: false, error: 'NOT_FOUND' });
    res.json({ success: true, preferences: prefs });
  });

  app.put('/api/v1/preferences', (req, res) => {
    const tokenMode = req.headers['x-peak-embed-prefs-mode'];
    const effective = typeof globalMode === 'function' ? globalMode(req) : resolvePreferenceMode(modeValue, tokenMode);
    if (effective === 'browser') {
      return res.status(403).json({ success: false, error: 'PREFERENCES_DISABLED' });
    }
    const viewerId = getViewerId(req);
    if (!viewerId) {
      if (requireAuth) return requireAuth(req, res);
      return res.status(401).json({ success: false, error: 'AUTH_REQUIRED' });
    }
    const { preferences, locked } = readRaw(req);
    if (preferences === undefined) {
      return res.status(400).json({ success: false, error: 'MISSING_FIELDS', message: 'preferences is required' });
    }
    if (store) store.writePreferences(viewerId, preferences);
    if (!req.cookies || !req.cookies.peak_vid) issueCookie(res);
    res.json({ success: true, preferences, locked: locked ?? [] });
  });
}

module.exports = { createPreferenceRoutes, resolvePreferenceMode, VALID_MODES };
